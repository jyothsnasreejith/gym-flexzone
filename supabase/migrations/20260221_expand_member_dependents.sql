begin;

alter table public.member_dependents
  add column if not exists relation text,
  add column if not exists email text,
  add column if not exists joining_date date,
  add column if not exists address text,
  add column if not exists area text,
  add column if not exists district text,
  add column if not exists pin_code text,
  add column if not exists emergency_contact text,
  add column if not exists emergency_relation text,
  add column if not exists batch_slot_id bigint,
  add column if not exists batch_start_time time,
  add column if not exists batch_end_time time,
  add column if not exists height_cm numeric,
  add column if not exists weight_kg numeric,
  add column if not exists bmi numeric,
  add column if not exists heart_rate numeric,
  add column if not exists blood_pressure text,
  add column if not exists sugar_level text,
  add column if not exists medical_issues text[],
  add column if not exists medical_other text,
  add column if not exists profile_image_url text,
  add column if not exists id_proof_type text,
  add column if not exists id_proof_url text;

create or replace function public.replace_member_dependents(
  p_member_id bigint,
  p_dependents jsonb
) returns void
language plpgsql
as $$
begin
  delete from public.member_dependents where member_id = p_member_id;

  if p_dependents is null then
    return;
  end if;

  insert into public.member_dependents (
    member_id,
    full_name,
    phone,
    gender,
    dob,
    relation,
    email,
    joining_date,
    address,
    area,
    district,
    pin_code,
    emergency_contact,
    emergency_relation,
    batch_slot_id,
    batch_start_time,
    batch_end_time,
    height_cm,
    weight_kg,
    bmi,
    heart_rate,
    blood_pressure,
    sugar_level,
    medical_issues,
    medical_other,
    profile_image_url,
    id_proof_type,
    id_proof_url
  )
  select
    p_member_id,
    nullif(dep->>'full_name','')::text,
    nullif(dep->>'phone','')::text,
    nullif(dep->>'gender','')::text,
    nullif(dep->>'dob','')::date,
    nullif(dep->>'relation','')::text,
    nullif(dep->>'email','')::text,
    nullif(dep->>'joining_date','')::date,
    nullif(dep->>'address','')::text,
    nullif(dep->>'area','')::text,
    nullif(dep->>'district','')::text,
    nullif(dep->>'pin_code','')::text,
    nullif(dep->>'emergency_contact','')::text,
    nullif(dep->>'emergency_relation','')::text,
    nullif(dep->>'batch_slot_id','')::bigint,
    nullif(dep->>'batch_start_time','')::time,
    nullif(dep->>'batch_end_time','')::time,
    nullif(dep->>'height_cm','')::numeric,
    nullif(dep->>'weight_kg','')::numeric,
    nullif(dep->>'bmi','')::numeric,
    nullif(dep->>'heart_rate','')::numeric,
    nullif(dep->>'blood_pressure','')::text,
    nullif(dep->>'sugar_level','')::text,
    case
      when dep ? 'medical_issues' then (
        select array_agg(value::text)
        from jsonb_array_elements_text(dep->'medical_issues') as t(value)
      )
      else null
    end,
    nullif(dep->>'medical_other','')::text,
    nullif(dep->>'profile_image_url','')::text,
    nullif(dep->>'id_proof_type','')::text,
    nullif(dep->>'id_proof_url','')::text
  from jsonb_array_elements(p_dependents) as dep;
end;
$$;

commit;
