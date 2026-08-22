begin;

create or replace function public.settle_competition_week(p_week_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_week public.competition_weeks;
  v_fixture_count integer;
  v_remaining integer;
  v_pick_count integer;
begin
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into v_week
  from public.competition_weeks
  where id=p_week_id
  for update;

  if v_week.id is null then raise exception 'Competition week not found'; end if;
  if not v_week.is_active_betting_week then raise exception 'Week is not a betting week'; end if;

  select
    count(*) filter(where is_eligible),
    count(*) filter(where is_eligible and status<>'final')
  into v_fixture_count,v_remaining
  from public.fixtures
  where competition_week_id=p_week_id;

  if v_fixture_count=0 then
    return jsonb_build_object('settled',false,'remaining',0,'reason','No eligible fixtures');
  end if;

  if now()>=v_week.lock_at and v_week.status='open' then
    update public.competition_weeks set status='locked' where id=p_week_id;
  end if;

  -- Clear any pick whose fixture is no longer final, so provider corrections
  -- cannot leave provisional points behind.
  update public.picks p
  set is_correct=null,settled_at=null
  from public.weekly_submissions s,public.fixtures f
  where p.submission_id=s.id
    and p.fixture_id=f.id
    and s.competition_week_id=p_week_id
    and f.status<>'final';

  -- Score every completed fixture immediately. This drives the live weekly
  -- table even while the rest of the slate is still being played.
  update public.picks p
  set
    is_correct=(p.selected_outcome=case
      when f.home_score>f.away_score then 'home'::public.outcome
      when f.away_score>f.home_score then 'away'::public.outcome
      else 'draw'::public.outcome
    end),
    settled_at=now()
  from public.weekly_submissions s,public.fixtures f
  where p.submission_id=s.id
    and p.fixture_id=f.id
    and s.competition_week_id=p_week_id
    and f.status='final';

  get diagnostics v_pick_count=row_count;

  -- Rebuild the week's pick ledger on every pass so the operation is
  -- idempotent and live scores stay correct after provider corrections.
  delete from public.points_ledger l
  using public.picks p,public.weekly_submissions s
  where l.reference_type='pick'
    and l.reference_id=p.id
    and l.type in ('weekly_bet_win','weekly_bet_loss')
    and p.submission_id=s.id
    and s.competition_week_id=p_week_id;

  insert into public.points_ledger(
    user_id,competition_week_id,type,reference_type,reference_id,amount,metadata,description
  )
  select
    s.user_id,
    p_week_id,
    case when p.is_correct then 'weekly_bet_win'::public.ledger_type else 'weekly_bet_loss'::public.ledger_type end,
    'pick',
    p.id,
    case when p.is_correct then round(p.stake*p.odds-p.stake,2) else -p.stake end,
    jsonb_build_object('fixture_id',p.fixture_id,'stake',p.stake,'odds',p.odds,'outcome',p.selected_outcome,'provisional',v_remaining>0),
    case when p.is_correct then 'Winning weekly pick' else 'Losing weekly pick' end
  from public.picks p
  join public.weekly_submissions s on s.id=p.submission_id
  where s.competition_week_id=p_week_id
    and p.is_correct is not null;

  -- Challenges, the official week close, and streak bonuses wait until every
  -- eligible fixture is final. Pick points above remain visible meanwhile.
  if v_remaining>0 then
    return jsonb_build_object('settled',false,'remaining',v_remaining,'picks',v_pick_count,'live',true);
  end if;

  update public.challenges c
  set
    challenger_weekly_net=coalesce((
      select sum(l.amount) from public.points_ledger l
      where l.user_id=c.challenger_id and l.competition_week_id=p_week_id
        and l.type in ('weekly_bet_win','weekly_bet_loss')
    ),0),
    opponent_weekly_net=coalesce((
      select sum(l.amount) from public.points_ledger l
      where l.user_id=c.opponent_id and l.competition_week_id=p_week_id
        and l.type in ('weekly_bet_win','weekly_bet_loss')
    ),0),
    settled_at=now()
  where c.competition_week_id=p_week_id;

  delete from public.points_ledger
  where competition_week_id=p_week_id
    and reference_type='challenge'
    and type in ('challenge_win','challenge_loss');

  insert into public.points_ledger(
    user_id,competition_week_id,type,reference_type,reference_id,amount,metadata,description
  )
  select
    case when c.challenger_weekly_net>c.opponent_weekly_net then c.challenger_id else c.opponent_id end,
    p_week_id,'challenge_win','challenge',c.id,10,
    jsonb_build_object('challenger_net',c.challenger_weekly_net,'opponent_net',c.opponent_weekly_net),
    'Won weekly head-to-head challenge'
  from public.challenges c
  where c.competition_week_id=p_week_id
    and c.challenger_weekly_net<>c.opponent_weekly_net;

  insert into public.points_ledger(
    user_id,competition_week_id,type,reference_type,reference_id,amount,metadata,description
  )
  select
    case when c.challenger_weekly_net<c.opponent_weekly_net then c.challenger_id else c.opponent_id end,
    p_week_id,'challenge_loss','challenge',c.id,-10,
    jsonb_build_object('challenger_net',c.challenger_weekly_net,'opponent_net',c.opponent_weekly_net),
    'Lost weekly head-to-head challenge'
  from public.challenges c
  where c.competition_week_id=p_week_id
    and c.challenger_weekly_net<>c.opponent_weekly_net;

  update public.competition_weeks set status='settled' where id=p_week_id;

  delete from public.points_ledger where type='streak_bonus';

  insert into public.points_ledger(
    user_id,competition_week_id,type,reference_type,reference_id,amount,metadata,description
  )
  with ordered as (
    select
      p.id pick_id,s.user_id,s.competition_week_id,w.number,w.start_date,p.is_correct,
      sum(case when p.is_correct=false then 1 else 0 end) over(
        partition by s.user_id order by w.start_date,w.number,p.id
      ) loss_group
    from public.picks p
    join public.weekly_submissions s on s.id=p.submission_id
    join public.competition_weeks w on w.id=s.competition_week_id
    where p.kind='gotw' and p.settled_at is not null and w.status='settled'
  ), wins as (
    select *,row_number() over(
      partition by user_id,loss_group order by start_date,number,pick_id
    ) win_number
    from ordered
    where is_correct=true
  )
  select
    user_id,competition_week_id,'streak_bonus','pick',pick_id,10,
    jsonb_build_object('streak_length',3),'Three straight Game of the Week wins'
  from wins
  where win_number%3=0;

  return jsonb_build_object('settled',true,'remaining',0,'picks',v_pick_count,'live',false);
end;
$$;

revoke all on function public.settle_competition_week(uuid) from public,anon;
grant execute on function public.settle_competition_week(uuid) to authenticated,service_role;

commit;
