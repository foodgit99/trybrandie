-- ============ Creator Network V1 (additive, isolated) ============
CREATE TABLE public.creator_network_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, UPDATE ON public.creator_network_settings TO authenticated;
GRANT ALL ON public.creator_network_settings TO service_role;
ALTER TABLE public.creator_network_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cn settings readable" ON public.creator_network_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "cn settings admin update" ON public.creator_network_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
INSERT INTO public.creator_network_settings (id, enabled) VALUES (true, false);

CREATE TABLE public.creator_network_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','research','partnerships','production','sales')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.creator_network_members TO authenticated;
GRANT ALL ON public.creator_network_members TO service_role;
ALTER TABLE public.creator_network_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.creator_network_enabled()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT enabled FROM public.creator_network_settings WHERE id), false)
$$;

CREATE OR REPLACE FUNCTION public.creator_network_has_access(_user_id uuid, _role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin')
    OR EXISTS (SELECT 1 FROM public.creator_network_members m
               WHERE m.user_id = _user_id AND (_role IS NULL OR m.role = _role OR m.role = 'admin'))
  )
$$;

CREATE OR REPLACE FUNCTION public.creator_network_can(_role text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.creator_network_enabled() AND public.creator_network_has_access(auth.uid(), _role)
$$;

CREATE POLICY "cn members self read" ON public.creator_network_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.creator_network_has_access(auth.uid(), 'admin'));
CREATE POLICY "cn members admin insert" ON public.creator_network_members FOR INSERT TO authenticated
  WITH CHECK (public.creator_network_has_access(auth.uid(), 'admin'));
CREATE POLICY "cn members admin delete" ON public.creator_network_members FOR DELETE TO authenticated
  USING (public.creator_network_has_access(auth.uid(), 'admin'));

CREATE SEQUENCE public.creator_network_crt_seq;
CREATE SEQUENCE public.creator_network_prs_seq;
CREATE SEQUENCE public.creator_network_mat_seq;
CREATE SEQUENCE public.creator_network_opp_seq;
CREATE SEQUENCE public.creator_network_con_seq;
CREATE SEQUENCE public.creator_network_job_seq;
CREATE SEQUENCE public.creator_network_tsk_seq;
CREATE SEQUENCE public.creator_network_sal_seq;
GRANT USAGE ON SEQUENCE public.creator_network_crt_seq, public.creator_network_prs_seq, public.creator_network_mat_seq,
  public.creator_network_opp_seq, public.creator_network_con_seq, public.creator_network_job_seq,
  public.creator_network_tsk_seq, public.creator_network_sal_seq TO authenticated, service_role;

CREATE TABLE public.creator_network_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL DEFAULT 'human' CHECK (actor_type IN ('human','ai','system')),
  actor_id uuid,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  previous_state text,
  new_state text,
  reason text,
  source text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('CRT-' || lpad(nextval('public.creator_network_crt_seq')::text, 4, '0')),
  user_id uuid,
  display_name text NOT NULL,
  legal_name text,
  handle text,
  primary_niche text,
  secondary_niches text[] NOT NULL DEFAULT '{}',
  location text,
  languages text[] NOT NULL DEFAULT '{}',
  persona text,
  content_formats text[] NOT NULL DEFAULT '{}',
  profile_image_path text,
  public_urls jsonb NOT NULL DEFAULT '[]',
  reach_indicators jsonb NOT NULL DEFAULT '{}',
  engagement_indicators jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'Researched' CHECK (status IN ('Researched','Qualified','Contact Pending','Contacted','Interested','Needs Human','Validation Pending','Validation Passed','Ready for Licence','Licensed','Paused','Rejected')),
  priority_tier text CHECK (priority_tier IN ('P1','P2','P3')),
  fit_score numeric,
  evidence_confidence text CHECK (evidence_confidence IN ('High','Medium','Low','Unknown')),
  camera_presence numeric,
  ai_likeness_suitability numeric,
  voice_suitability numeric,
  content_versatility numeric,
  commercial_category_breadth numeric,
  recruitability numeric,
  audience_commercial_relevance numeric,
  brand_safety_status text NOT NULL DEFAULT 'Not Reviewed' CHECK (brand_safety_status IN ('Not Reviewed','Clear','Needs Review','Flagged')),
  licensing_interest text NOT NULL DEFAULT 'Unknown' CHECK (licensing_interest IN ('Unknown','Interested','Not Interested','Undecided')),
  contact_status text NOT NULL DEFAULT 'Not Contacted' CHECK (contact_status IN ('Not Contacted','Contacted','Responded','No Response')),
  contact_details jsonb NOT NULL DEFAULT '{}',
  human_owner uuid,
  next_action text,
  notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_audience_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  age_range text, gender_composition text, geography text, cities_regions text[] NOT NULL DEFAULT '{}',
  interests text[] NOT NULL DEFAULT '{}', lifestyle text, purchasing_categories text[] NOT NULL DEFAULT '{}',
  affluence_segment text, audience_description text, evidence_type text,
  confidence text CHECK (confidence IN ('High','Medium','Low','Unknown')),
  evidence_classification text NOT NULL DEFAULT 'Unknown' CHECK (evidence_classification IN ('Verified','Estimated','Inferred','Self-reported','Human-confirmed','Unknown')),
  source text, date_observed date,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  validation_type text NOT NULL CHECK (validation_type IN ('licensing_interest','likeness_licensing','voice_licensing','paid_ad_permission','organic_ad_permission','creator_posted_permission','approval_requirements','restricted_industries','restricted_brands','geographic_usage_rights','licence_duration','compensation_expectations','rates','recent_video_samples','audience_insights','identity_verification','camera_test','digital_twin_test','voice_reproduction_test','motion_reproduction_test')),
  owner_type text NOT NULL DEFAULT 'Human' CHECK (owner_type IN ('AI','Human')),
  human_owner uuid,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Requested','Passed','Failed','Not Applicable')),
  question text, response text, evidence text,
  evidence_classification text NOT NULL DEFAULT 'Unknown' CHECK (evidence_classification IN ('Verified','Estimated','Inferred','Self-reported','Human-confirmed','Unknown')),
  score numeric, requested_at timestamptz, completed_at timestamptz, follow_up text, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_id, validation_type)
);

CREATE TABLE public.creator_network_interviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  interviewer uuid,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Submitted')),
  scheduled_at timestamptz,
  responses jsonb NOT NULL DEFAULT '[]',
  summary text,
  submitted_at timestamptz,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('PRS-' || lpad(nextval('public.creator_network_prs_seq')::text, 4, '0')),
  converted_brand_id uuid,
  business_name text NOT NULL,
  category text, subcategory text, location text,
  urls jsonb NOT NULL DEFAULT '[]',
  public_contact text, products_summary text, target_customer text, brand_positioning text,
  visual_style text, content_formats text[] NOT NULL DEFAULT '{}', observed_content_gap text,
  commercial_activity text, reachability text, purchase_ability_estimate text, spec_ad_potential text,
  evidence_confidence text CHECK (evidence_confidence IN ('High','Medium','Low','Unknown')),
  human_owner uuid, next_action text, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_prospect_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.creator_network_prospects(id) ON DELETE CASCADE,
  name text NOT NULL, description text, category text, price numeric, currency text DEFAULT 'NGN',
  image_url text, product_url text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('MAT-' || lpad(nextval('public.creator_network_mat_seq')::text, 4, '0')),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  brand_id uuid, prospect_id uuid REFERENCES public.creator_network_prospects(id) ON DELETE CASCADE,
  product_source text CHECK (product_source IN ('brand_product','prospect_product')),
  product_id uuid,
  total_score numeric,
  scores jsonb NOT NULL DEFAULT '{}',
  reasoning text, risks text,
  confidence text CHECK (confidence IN ('High','Medium','Low','Unknown')),
  status text NOT NULL DEFAULT 'Proposed' CHECK (status IN ('Proposed','Reviewed','Accepted','Rejected')),
  priority text, evaluated_at timestamptz DEFAULT now(), score_version text NOT NULL DEFAULT 'v1',
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (brand_id IS NOT NULL OR prospect_id IS NOT NULL)
);

CREATE TABLE public.creator_network_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('OPP-' || lpad(nextval('public.creator_network_opp_seq')::text, 4, '0')),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.creator_network_matches(id) ON DELETE SET NULL,
  brand_id uuid, prospect_id uuid REFERENCES public.creator_network_prospects(id) ON DELETE SET NULL,
  product_source text, product_id uuid,
  stage text NOT NULL DEFAULT 'Identified' CHECK (stage IN ('Identified','Validated','Creative Strategy','Ready for Production','Producing','QA','Ready for Outreach','Outreach Sent','Engaged','Checkout','Won','Lost','Fulfilled')),
  opportunity_score numeric, priority text, campaign_objective text, recommended_format text,
  creative_angle text, expected_complexity text, estimated_production_cost numeric,
  proposed_selling_price numeric, creator_royalty_estimate numeric, expected_gross_margin numeric,
  currency text NOT NULL DEFAULT 'NGN',
  human_owner uuid, next_action text, outcome text, lost_reason text, blocker text, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (stage <> 'Lost' OR lost_reason IS NOT NULL)
);

CREATE TABLE public.creator_network_concepts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('CON-' || lpad(nextval('public.creator_network_con_seq')::text, 4, '0')),
  opportunity_id uuid NOT NULL REFERENCES public.creator_network_opportunities(id) ON DELETE CASCADE,
  creator_id uuid REFERENCES public.creator_network_creators(id) ON DELETE SET NULL,
  brand_id uuid, prospect_id uuid, product_source text, product_id uuid,
  concept_name text NOT NULL, format text, hook text, strategic_idea text, story_structure text,
  creator_role text CHECK (creator_role IN ('Spokesperson','Demonstrator','Customer Proxy','Host','Lifestyle Model','Narrator')),
  claims jsonb NOT NULL DEFAULT '[]',
  product_placement text, cta text, platform text, duration_seconds integer, required_assets text,
  production_complexity text, creative_score numeric,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Selected','Approved','Rejected','Needs Revision')),
  approved_by uuid, approved_at timestamptz, approval_notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX creator_network_concepts_one_selected
  ON public.creator_network_concepts(opportunity_id) WHERE status IN ('Selected','Approved');

CREATE TABLE public.creator_network_licences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  brand_id uuid, prospect_id uuid, opportunity_id uuid REFERENCES public.creator_network_opportunities(id) ON DELETE SET NULL,
  production_job_id uuid,
  licence_scope text NOT NULL DEFAULT 'Commercial' CHECK (licence_scope IN ('Preview','Commercial')),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Negotiating','Signed','Active','Expired','Revoked')),
  likeness_permission boolean NOT NULL DEFAULT false,
  voice_permission boolean NOT NULL DEFAULT false,
  organic_social_permission boolean NOT NULL DEFAULT false,
  paid_advertising_permission boolean NOT NULL DEFAULT false,
  creator_posted_permission boolean NOT NULL DEFAULT false,
  digital_twin_permission boolean NOT NULL DEFAULT false,
  platforms text[] NOT NULL DEFAULT '{}', territories text[] NOT NULL DEFAULT '{}',
  starts_at date, expires_at date, duration_months integer,
  restricted_categories text[] NOT NULL DEFAULT '{}', restricted_brands text[] NOT NULL DEFAULT '{}',
  creator_approval_required boolean NOT NULL DEFAULT true, approval_requirements text,
  agreement_path text, compensation_model text CHECK (compensation_model IN ('Fixed','Royalty','Hybrid')),
  fixed_fee numeric, royalty_rate numeric, currency text NOT NULL DEFAULT 'NGN',
  payment_status text NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid','Partial','Paid')),
  revoked boolean NOT NULL DEFAULT false, revoked_at timestamptz, revocation_reason text, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT revoked OR revocation_reason IS NOT NULL)
);

CREATE TABLE public.creator_network_production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('JOB-' || lpad(nextval('public.creator_network_job_seq')::text, 4, '0')),
  opportunity_id uuid NOT NULL REFERENCES public.creator_network_opportunities(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.creator_network_concepts(id),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id),
  brand_id uuid, prospect_id uuid, product_source text, product_id uuid,
  rights_mode text NOT NULL DEFAULT 'Preview' CHECK (rights_mode IN ('Preview','Commercial')),
  design_job_id uuid, video_project_id uuid,
  human_owner uuid,
  stage text NOT NULL DEFAULT 'Brief' CHECK (stage IN ('Brief','Script','Storyboard','Asset Prep','Scene Generation','Assembly','AI QA','Human QA','Watermark','Ready')),
  production_cost numeric NOT NULL DEFAULT 0,
  regeneration_count integer NOT NULL DEFAULT 0,
  human_intervention_count integer NOT NULL DEFAULT 0,
  preview_path text, clean_master_path text,
  blocked boolean NOT NULL DEFAULT false, blocker text, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT blocked OR blocker IS NOT NULL)
);

CREATE TABLE public.creator_network_production_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.creator_network_production_jobs(id) ON DELETE CASCADE,
  stage text NOT NULL,
  ai_output text, output_url text,
  decision text NOT NULL CHECK (decision IN ('Approve','Edit','Reject','Regenerate')),
  human_edit text, reason text,
  reviewer uuid, reviewed_at timestamptz NOT NULL DEFAULT now(),
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision = 'Approve' OR (reason IS NOT NULL AND length(btrim(reason)) > 0))
);

CREATE TABLE public.creator_network_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('SAL-' || lpad(nextval('public.creator_network_sal_seq')::text, 4, '0')),
  opportunity_id uuid NOT NULL REFERENCES public.creator_network_opportunities(id) ON DELETE CASCADE,
  brand_id uuid, prospect_id uuid,
  creator_id uuid REFERENCES public.creator_network_creators(id),
  product_source text, product_id uuid,
  production_job_id uuid REFERENCES public.creator_network_production_jobs(id) ON DELETE SET NULL,
  contact text, channel text CHECK (channel IN ('Email','WhatsApp','Instagram DM','Phone','In Person','Other')),
  offer_price numeric, currency text NOT NULL DEFAULT 'NGN',
  outreach_message text, sent_at timestamptz, response text,
  response_classification text CHECK (response_classification IN ('Interested','Not Interested','Needs More Information','Price Objection','Timing Objection','Creator Concern','No Response','Wrong Contact','Negotiating','Won','Lost')),
  follow_up_at timestamptz, salesperson uuid,
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Responded','Negotiating','Won','Lost')),
  payment_status text NOT NULL DEFAULT 'Unpaid' CHECK (payment_status IN ('Unpaid','Pending','Paid','Refunded')),
  paid_amount numeric, creator_royalty numeric, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id),
  amount numeric NOT NULL, currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Paid','Cancelled')),
  method text, reference text, paid_at timestamptz, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id),
  opportunity_id uuid REFERENCES public.creator_network_opportunities(id) ON DELETE SET NULL,
  sale_id uuid UNIQUE REFERENCES public.creator_network_sales(id) ON DELETE SET NULL,
  earning_type text NOT NULL DEFAULT 'Royalty' CHECK (earning_type IN ('Fixed Fee','Royalty','Hybrid','Adjustment')),
  fixed_fee numeric NOT NULL DEFAULT 0, royalty numeric NOT NULL DEFAULT 0,
  gross_sale_amount numeric, payable_amount numeric NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Paid','Cancelled')),
  paid_at timestamptz, payout_id uuid REFERENCES public.creator_network_payouts(id) ON DELETE SET NULL, payout_reference text,
  record_source text NOT NULL DEFAULT 'system' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  related_entity_type text NOT NULL CHECK (related_entity_type IN ('creator','prospect','brand','product','match','opportunity')),
  creator_id uuid REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.creator_network_prospects(id) ON DELETE CASCADE,
  brand_id uuid, product_id uuid,
  match_id uuid REFERENCES public.creator_network_matches(id) ON DELETE CASCADE,
  opportunity_id uuid REFERENCES public.creator_network_opportunities(id) ON DELETE CASCADE,
  finding text NOT NULL, data_type text,
  confidence text CHECK (confidence IN ('High','Medium','Low','Unknown')),
  evidence_classification text NOT NULL DEFAULT 'Unknown' CHECK (evidence_classification IN ('Verified','Estimated','Inferred','Self-reported','Human-confirmed','Unknown')),
  source_url text, source_name text, retrieved_at timestamptz, last_verified_at timestamptz,
  research_agent text,
  supersedes_finding_id uuid REFERENCES public.creator_network_findings(id),
  is_current boolean NOT NULL DEFAULT true,
  notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE DEFAULT ('TSK-' || lpad(nextval('public.creator_network_tsk_seq')::text, 4, '0')),
  title text NOT NULL,
  why text, context text,
  creator_id uuid REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.creator_network_prospects(id) ON DELETE CASCADE,
  brand_id uuid,
  match_id uuid REFERENCES public.creator_network_matches(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.creator_network_opportunities(id) ON DELETE SET NULL,
  production_job_id uuid REFERENCES public.creator_network_production_jobs(id) ON DELETE SET NULL,
  owner_type text NOT NULL DEFAULT 'Human' CHECK (owner_type IN ('AI','Human')),
  human_assignee uuid, ai_agent text,
  status text NOT NULL DEFAULT 'Ready' CHECK (status IN ('Backlog','Ready','In Progress','Waiting on AI','Waiting on Human','Waiting on Creator','Waiting on Business','Blocked','Review','Done')),
  priority text NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Urgent','High','Normal','Low')),
  depends_on_task_id uuid REFERENCES public.creator_network_tasks(id) ON DELETE SET NULL,
  blocker text, required_input text, expected_output text, output text, next_step text,
  review_required boolean NOT NULL DEFAULT false, reviewer uuid,
  due_at timestamptz, completed_at timestamptz,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (status <> 'Blocked' OR blocker IS NOT NULL)
);

CREATE TABLE public.creator_network_ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES public.creator_network_tasks(id) ON DELETE SET NULL,
  agent text NOT NULL, objective text NOT NULL,
  entity_type text, entity_id uuid,
  triggered_by uuid,
  status text NOT NULL DEFAULT 'Queued' CHECK (status IN ('Queued','Running','Completed','Failed','Needs Review')),
  input jsonb NOT NULL DEFAULT '{}', output jsonb, evidence jsonb,
  confidence text, error text, model_used text,
  started_at timestamptz, ended_at timestamptz,
  record_source text NOT NULL DEFAULT 'ai' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_brand_safety_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.creator_network_creators(id) ON DELETE CASCADE,
  reviewed boolean NOT NULL DEFAULT false, reviewed_at timestamptz, reviewer uuid,
  public_issue text, evidence text,
  human_decision text CHECK (human_decision IN ('Clear','Needs Review','Flagged')),
  notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.creator_network_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hypothesis text NOT NULL, metric_key text, success_criteria text,
  status text NOT NULL DEFAULT 'Planned' CHECK (status IN ('Planned','Running','Concluded','Abandoned')),
  started_at timestamptz, ended_at timestamptz, conclusion text, owner uuid, notes text,
  record_source text NOT NULL DEFAULT 'human' CHECK (record_source IN ('production','import','ai','human','test','system')),
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE t text;
  write_role text;
BEGIN
  FOR t, write_role IN SELECT * FROM (VALUES
    ('creator_network_activity_log', NULL),
    ('creator_network_creators', NULL),
    ('creator_network_audience_profiles', 'research'),
    ('creator_network_validations', 'partnerships'),
    ('creator_network_interviews', 'partnerships'),
    ('creator_network_prospects', NULL),
    ('creator_network_prospect_products', NULL),
    ('creator_network_matches', 'research'),
    ('creator_network_opportunities', NULL),
    ('creator_network_concepts', NULL),
    ('creator_network_licences', 'partnerships'),
    ('creator_network_production_jobs', 'production'),
    ('creator_network_production_reviews', 'production'),
    ('creator_network_sales', 'sales'),
    ('creator_network_payouts', 'admin'),
    ('creator_network_earnings', 'admin'),
    ('creator_network_findings', 'research'),
    ('creator_network_tasks', NULL),
    ('creator_network_ai_runs', NULL),
    ('creator_network_brand_safety_reviews', 'research'),
    ('creator_network_experiments', NULL)
  ) v(a,b) LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "cn read" ON public.%I FOR SELECT TO authenticated USING (public.creator_network_can(NULL))', t);
    EXECUTE format('CREATE POLICY "cn insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.creator_network_can(%L))', t, write_role);
    EXECUTE format('CREATE POLICY "cn update" ON public.%I FOR UPDATE TO authenticated USING (public.creator_network_can(%L)) WITH CHECK (public.creator_network_can(%L))', t, write_role, write_role);
    EXECUTE format('CREATE POLICY "cn delete" ON public.%I FOR DELETE TO authenticated USING (public.creator_network_can(''admin''))', t);
  END LOOP;
END $$;

DROP POLICY "cn update" ON public.creator_network_activity_log;
CREATE POLICY "cn update" ON public.creator_network_activity_log FOR UPDATE TO authenticated
  USING (public.creator_network_can('admin')) WITH CHECK (public.creator_network_can('admin'));
DROP POLICY "cn update" ON public.creator_network_findings;
CREATE POLICY "cn update" ON public.creator_network_findings FOR UPDATE TO authenticated
  USING (public.creator_network_can('admin')) WITH CHECK (public.creator_network_can('admin'));

CREATE OR REPLACE FUNCTION public.creator_network_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.creator_network_log_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE col text := TG_ARGV[0];
  old_v text; new_v text; entity text := TG_ARGV[1];
BEGIN
  new_v := to_jsonb(NEW) ->> col;
  IF TG_OP = 'UPDATE' THEN old_v := to_jsonb(OLD) ->> col; END IF;
  IF TG_OP = 'INSERT' OR old_v IS DISTINCT FROM new_v THEN
    INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, previous_state, new_state, reason, source, record_source, is_test)
    VALUES (CASE WHEN auth.uid() IS NULL THEN 'system' ELSE 'human' END, auth.uid(),
      CASE WHEN TG_OP='INSERT' THEN entity || '_created' ELSE entity || '_' || col || '_changed' END,
      entity, NEW.id, old_v, new_v,
      COALESCE(to_jsonb(NEW) ->> 'lost_reason', to_jsonb(NEW) ->> 'revocation_reason', to_jsonb(NEW) ->> 'blocker', to_jsonb(NEW) ->> 'reason'),
      TG_TABLE_NAME, CASE WHEN COALESCE((to_jsonb(NEW)->>'is_test')::boolean,false) THEN 'test' ELSE 'system' END,
      COALESCE((to_jsonb(NEW)->>'is_test')::boolean, false));
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text; c text; e text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['creator_network_creators','creator_network_audience_profiles','creator_network_validations','creator_network_interviews','creator_network_prospects','creator_network_prospect_products','creator_network_matches','creator_network_opportunities','creator_network_concepts','creator_network_licences','creator_network_production_jobs','creator_network_sales','creator_network_payouts','creator_network_earnings','creator_network_tasks','creator_network_brand_safety_reviews','creator_network_experiments']) LOOP
    EXECUTE format('CREATE TRIGGER cn_touch BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.creator_network_touch()', t);
  END LOOP;
  FOR t, c, e IN SELECT * FROM (VALUES
    ('creator_network_creators','status','creator'),
    ('creator_network_validations','status','validation'),
    ('creator_network_interviews','status','interview'),
    ('creator_network_matches','status','match'),
    ('creator_network_opportunities','stage','opportunity'),
    ('creator_network_concepts','status','concept'),
    ('creator_network_licences','status','licence'),
    ('creator_network_production_jobs','stage','production_job'),
    ('creator_network_production_reviews','decision','production_review'),
    ('creator_network_sales','status','sale'),
    ('creator_network_earnings','status','earning'),
    ('creator_network_payouts','status','payout'),
    ('creator_network_tasks','status','task'),
    ('creator_network_brand_safety_reviews','human_decision','brand_safety')
  ) v(a,b,c2) LOOP
    EXECUTE format('CREATE TRIGGER cn_log AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.creator_network_log_transition(%L, %L)', t, c, e);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.creator_network_after_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.creator_network_production_jobs SET
    regeneration_count = regeneration_count + CASE WHEN NEW.decision = 'Regenerate' THEN 1 ELSE 0 END,
    human_intervention_count = human_intervention_count + CASE WHEN NEW.decision IN ('Edit','Reject','Regenerate') THEN 1 ELSE 0 END
  WHERE id = NEW.job_id;
  RETURN NEW;
END $$;
CREATE TRIGGER cn_after_review AFTER INSERT ON public.creator_network_production_reviews
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_after_review();

CREATE OR REPLACE FUNCTION public.creator_network_has_commercial_licence(_creator uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.creator_network_licences l
    WHERE l.creator_id = _creator AND l.licence_scope = 'Commercial' AND l.status IN ('Signed','Active')
      AND NOT l.revoked AND (l.expires_at IS NULL OR l.expires_at >= current_date)
      AND (l.paid_advertising_permission OR l.organic_social_permission))
$$;

CREATE OR REPLACE FUNCTION public.creator_network_gate_production()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cs text;
BEGIN
  SELECT status INTO cs FROM public.creator_network_concepts WHERE id = NEW.concept_id;
  IF cs IS DISTINCT FROM 'Approved' THEN
    RAISE EXCEPTION 'Concept must be human-approved before production';
  END IF;
  IF NEW.rights_mode = 'Commercial' AND NOT public.creator_network_has_commercial_licence(NEW.creator_id) THEN
    RAISE EXCEPTION 'Commercial production blocked: creator has no active commercial licence';
  END IF;
  IF NEW.clean_master_path IS NOT NULL AND NEW.rights_mode <> 'Commercial' THEN
    RAISE EXCEPTION 'Clean masters require commercial rights';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cn_gate_production BEFORE INSERT OR UPDATE OF rights_mode, concept_id, clean_master_path
  ON public.creator_network_production_jobs FOR EACH ROW EXECUTE FUNCTION public.creator_network_gate_production();

CREATE OR REPLACE FUNCTION public.creator_network_concept_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'Approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'Approved') THEN
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cn_concept_approval BEFORE INSERT OR UPDATE ON public.creator_network_concepts
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_concept_approval();

CREATE OR REPLACE FUNCTION public.creator_network_after_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target text;
BEGIN
  target := CASE
    WHEN NEW.status = 'Won' THEN 'Won'
    WHEN NEW.status = 'Lost' THEN 'Lost'
    WHEN NEW.status = 'Negotiating' THEN 'Checkout'
    WHEN NEW.status = 'Responded' THEN 'Engaged'
    WHEN NEW.status = 'Sent' THEN 'Outreach Sent'
    ELSE NULL END;
  IF target IS NOT NULL THEN
    UPDATE public.creator_network_opportunities
      SET stage = target,
          lost_reason = CASE WHEN target = 'Lost' THEN COALESCE(lost_reason, NEW.response_classification, 'Sale lost') ELSE lost_reason END
      WHERE id = NEW.opportunity_id AND stage NOT IN ('Fulfilled') AND stage IS DISTINCT FROM target;
  END IF;
  IF NEW.payment_status = 'Paid' AND NEW.creator_id IS NOT NULL THEN
    INSERT INTO public.creator_network_earnings(creator_id, opportunity_id, sale_id, earning_type, royalty, gross_sale_amount, payable_amount, currency, record_source, is_test)
    VALUES (NEW.creator_id, NEW.opportunity_id, NEW.id, 'Royalty', COALESCE(NEW.creator_royalty,0), NEW.paid_amount, COALESCE(NEW.creator_royalty,0), NEW.currency, 'system', NEW.is_test)
    ON CONFLICT (sale_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cn_after_sale AFTER INSERT OR UPDATE OF status, payment_status ON public.creator_network_sales
  FOR EACH ROW EXECUTE FUNCTION public.creator_network_after_sale();

CREATE OR REPLACE FUNCTION public.creator_network_supersede_finding(_old_id uuid, _finding text, _classification text, _confidence text, _source_url text, _source_name text, _notes text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.creator_network_findings; new_id uuid;
BEGIN
  IF NOT public.creator_network_can('research') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO o FROM public.creator_network_findings WHERE id = _old_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finding not found'; END IF;
  IF NOT o.is_current THEN RAISE EXCEPTION 'Finding already superseded'; END IF;
  INSERT INTO public.creator_network_findings(related_entity_type, creator_id, prospect_id, brand_id, product_id, match_id, opportunity_id,
    finding, data_type, confidence, evidence_classification, source_url, source_name, retrieved_at, research_agent,
    supersedes_finding_id, is_current, notes, record_source, is_test, created_by)
  VALUES (o.related_entity_type, o.creator_id, o.prospect_id, o.brand_id, o.product_id, o.match_id, o.opportunity_id,
    _finding, o.data_type, _confidence, COALESCE(_classification,'Unknown'), _source_url, _source_name, now(), 'human',
    o.id, true, _notes, 'human', o.is_test, auth.uid())
  RETURNING id INTO new_id;
  UPDATE public.creator_network_findings SET is_current = false WHERE id = o.id;
  INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, previous_state, new_state, source, record_source, is_test)
  VALUES ('human', auth.uid(), 'finding_superseded', 'finding', o.id, o.id::text, new_id::text, 'evidence', 'human', o.is_test);
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.creator_network_submit_interview(_interview_id uuid, _responses jsonb, _summary text, _creator_updates jsonb, _next_action text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE iv public.creator_network_interviews; r jsonb;
BEGIN
  IF NOT public.creator_network_can('partnerships') THEN RAISE EXCEPTION 'Not authorised'; END IF;
  SELECT * INTO iv FROM public.creator_network_interviews WHERE id = _interview_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Interview not found'; END IF;
  IF iv.status = 'Submitted' THEN RAISE EXCEPTION 'Interview already submitted'; END IF;

  UPDATE public.creator_network_interviews
    SET status='Submitted', responses=COALESCE(_responses,'[]'), summary=_summary, submitted_at=now(), interviewer=COALESCE(interviewer, auth.uid())
    WHERE id = _interview_id;

  FOR r IN SELECT * FROM jsonb_array_elements(COALESCE(_responses,'[]')) LOOP
    IF COALESCE(r->>'response','') <> '' THEN
      INSERT INTO public.creator_network_validations(creator_id, validation_type, owner_type, human_owner, status, question, response, evidence, evidence_classification, score, completed_at, record_source, is_test)
      VALUES (iv.creator_id, r->>'validation_type', 'Human', auth.uid(), COALESCE(r->>'status','Passed'), r->>'question', r->>'response',
              'Interview ' || _interview_id::text, 'Human-confirmed', NULLIF(r->>'score','')::numeric, now(), 'human', iv.is_test)
      ON CONFLICT (creator_id, validation_type) DO UPDATE SET
        status = EXCLUDED.status, question = EXCLUDED.question, response = EXCLUDED.response, evidence = EXCLUDED.evidence,
        evidence_classification = 'Human-confirmed', score = EXCLUDED.score, completed_at = now(), human_owner = auth.uid();
    END IF;
  END LOOP;

  UPDATE public.creator_network_creators SET
    licensing_interest = COALESCE(_creator_updates->>'licensing_interest', licensing_interest),
    contact_status = COALESCE(_creator_updates->>'contact_status', contact_status),
    status = COALESCE(_creator_updates->>'status', status),
    camera_presence = COALESCE(NULLIF(_creator_updates->>'camera_presence','')::numeric, camera_presence),
    voice_suitability = COALESCE(NULLIF(_creator_updates->>'voice_suitability','')::numeric, voice_suitability),
    next_action = COALESCE(_next_action, next_action)
  WHERE id = iv.creator_id;

  INSERT INTO public.creator_network_activity_log(actor_type, actor_id, action, entity_type, entity_id, previous_state, new_state, reason, source, record_source, is_test)
  VALUES ('human', auth.uid(), 'interview_submitted', 'creator', iv.creator_id, 'Draft', 'Submitted', _summary, 'interview', 'human', iv.is_test);
END $$;

GRANT EXECUTE ON FUNCTION public.creator_network_enabled(), public.creator_network_has_access(uuid, text), public.creator_network_can(text),
  public.creator_network_has_commercial_licence(uuid),
  public.creator_network_supersede_finding(uuid, text, text, text, text, text, text),
  public.creator_network_submit_interview(uuid, jsonb, text, jsonb, text) TO authenticated;

ALTER TABLE public.content_ideas ADD COLUMN IF NOT EXISTS creator_network_source_id uuid;
COMMENT ON COLUMN public.content_ideas.creator_network_source_id IS 'Optional link to a Creator Network sale/production job that produced this idea.';

CREATE POLICY "cn assets read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'creator-network-assets' AND public.creator_network_can(NULL));
CREATE POLICY "cn assets write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'creator-network-assets' AND public.creator_network_can(NULL));
CREATE POLICY "cn assets update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'creator-network-assets' AND public.creator_network_can(NULL));
CREATE POLICY "cn assets delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'creator-network-assets' AND public.creator_network_can('admin'));

CREATE INDEX ON public.creator_network_tasks(status);
CREATE INDEX ON public.creator_network_opportunities(stage);
CREATE INDEX ON public.creator_network_findings(creator_id, is_current);
CREATE INDEX ON public.creator_network_activity_log(entity_type, entity_id, created_at DESC);