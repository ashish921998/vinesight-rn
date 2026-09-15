-- Cache request-constant auth values once per statement; preserve all access predicates and roles.
SET lock_timeout = '5s';

ALTER POLICY "agronomy_chunk_embeddings_owner_write" ON "public"."agronomy_chunk_embeddings"
  USING ((EXISTS ( SELECT 1
   FROM (agronomy_doc_chunks c
     JOIN agronomy_docs d ON ((d.id = c.doc_id)))
  WHERE ((c.id = agronomy_chunk_embeddings.chunk_id) AND (d.created_by = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (agronomy_doc_chunks c
     JOIN agronomy_docs d ON ((d.id = c.doc_id)))
  WHERE ((c.id = agronomy_chunk_embeddings.chunk_id) AND (d.created_by = (select auth.uid()))))));

ALTER POLICY "agronomy_chunk_embeddings_read_public" ON "public"."agronomy_chunk_embeddings"
  USING ((EXISTS ( SELECT 1
   FROM (agronomy_doc_chunks c
     JOIN agronomy_docs d ON ((d.id = c.doc_id)))
  WHERE ((c.id = agronomy_chunk_embeddings.chunk_id) AND (d.is_public OR (d.created_by = (select auth.uid())))))));

ALTER POLICY "agronomy_doc_chunks_owner_write" ON "public"."agronomy_doc_chunks"
  USING ((EXISTS ( SELECT 1
   FROM agronomy_docs d
  WHERE ((d.id = agronomy_doc_chunks.doc_id) AND (d.created_by = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM agronomy_docs d
  WHERE ((d.id = agronomy_doc_chunks.doc_id) AND (d.created_by = (select auth.uid()))))));

ALTER POLICY "agronomy_doc_chunks_read_public" ON "public"."agronomy_doc_chunks"
  USING ((EXISTS ( SELECT 1
   FROM agronomy_docs d
  WHERE ((d.id = agronomy_doc_chunks.doc_id) AND (d.is_public OR (d.created_by = (select auth.uid())))))));

ALTER POLICY "agronomy_docs_owner_write" ON "public"."agronomy_docs"
  USING ((created_by = (select auth.uid())))
  WITH CHECK ((created_by = (select auth.uid())));

ALTER POLICY "agronomy_docs_read_public" ON "public"."agronomy_docs"
  USING ((is_public OR (created_by = (select auth.uid()))));

ALTER POLICY "Users can delete their own alerts" ON "public"."ai_alerts"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own alerts" ON "public"."ai_alerts"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own alerts" ON "public"."ai_alerts"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own alerts" ON "public"."ai_alerts"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can delete their own context cache" ON "public"."ai_context_cache"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own context cache" ON "public"."ai_context_cache"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own context cache" ON "public"."ai_context_cache"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own context cache" ON "public"."ai_context_cache"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can access context from their conversations" ON "public"."ai_conversation_context"
  USING ((EXISTS ( SELECT 1
   FROM ai_conversations
  WHERE ((ai_conversations.id = ai_conversation_context.conversation_id) AND (ai_conversations.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete their own conversations" ON "public"."ai_conversations"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own conversations" ON "public"."ai_conversations"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own conversations" ON "public"."ai_conversations"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own conversations" ON "public"."ai_conversations"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can delete messages from their conversations" ON "public"."ai_messages"
  USING ((EXISTS ( SELECT 1
   FROM ai_conversations
  WHERE ((ai_conversations.id = ai_messages.conversation_id) AND (ai_conversations.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert messages to their conversations" ON "public"."ai_messages"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM ai_conversations
  WHERE ((ai_conversations.id = ai_messages.conversation_id) AND (ai_conversations.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update messages in their conversations" ON "public"."ai_messages"
  USING ((EXISTS ( SELECT 1
   FROM ai_conversations
  WHERE ((ai_conversations.id = ai_messages.conversation_id) AND (ai_conversations.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view messages from their conversations" ON "public"."ai_messages"
  USING ((EXISTS ( SELECT 1
   FROM ai_conversations
  WHERE ((ai_conversations.id = ai_messages.conversation_id) AND (ai_conversations.user_id = (select auth.uid()))))));

ALTER POLICY "Users can see their farm task recommendations" ON "public"."ai_task_recommendations"
  USING ((((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = ai_task_recommendations.farm_id) AND (farms.user_id = (select auth.uid())))))));

ALTER POLICY "assistant_conversations_owner_all" ON "public"."assistant_conversations"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "assistant_memories_owner_all" ON "public"."assistant_memories"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "assistant_memory_embeddings_owner_delete" ON "public"."assistant_memory_embeddings"
  USING ((EXISTS ( SELECT 1
   FROM assistant_memories m
  WHERE ((m.id = assistant_memory_embeddings.memory_id) AND (m.user_id = (select auth.uid()))))));

ALTER POLICY "assistant_memory_embeddings_owner_insert" ON "public"."assistant_memory_embeddings"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM assistant_memories m
  WHERE ((m.id = assistant_memory_embeddings.memory_id) AND (m.user_id = (select auth.uid()))))));

ALTER POLICY "assistant_memory_embeddings_owner_select" ON "public"."assistant_memory_embeddings"
  USING ((EXISTS ( SELECT 1
   FROM assistant_memories m
  WHERE ((m.id = assistant_memory_embeddings.memory_id) AND (m.user_id = (select auth.uid()))))));

ALTER POLICY "assistant_turns_owner_all" ON "public"."assistant_turns"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can access calculation history for their farms" ON "public"."calculation_history"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = calculation_history.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete calculation history for their farms" ON "public"."calculation_history"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = calculation_history.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert calculation history for their farms" ON "public"."calculation_history"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = calculation_history.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update calculation history for their farms" ON "public"."calculation_history"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = calculation_history.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their farm calculation history" ON "public"."calculation_history"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = calculation_history.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert canopy analyses for their farms" ON "public"."canopy_analyses"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = canopy_analyses.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view canopy analyses for their farms" ON "public"."canopy_analyses"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = canopy_analyses.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can access community insights" ON "public"."community_insights"
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Users can contribute community insights" ON "public"."community_insights"
  WITH CHECK (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Daily notes are deletable by farm owners" ON "public"."daily_notes"
  USING ((EXISTS ( SELECT 1
   FROM farms f
  WHERE ((f.id = daily_notes.farm_id) AND (f.user_id = (select auth.uid()))))));

ALTER POLICY "Daily notes are insertable by farm owners" ON "public"."daily_notes"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms f
  WHERE ((f.id = daily_notes.farm_id) AND (f.user_id = (select auth.uid()))))));

ALTER POLICY "Daily notes are updatable by farm owners" ON "public"."daily_notes"
  USING ((EXISTS ( SELECT 1
   FROM farms f
  WHERE ((f.id = daily_notes.farm_id) AND (f.user_id = (select auth.uid()))))));

ALTER POLICY "Daily notes are viewable by farm owners" ON "public"."daily_notes"
  USING ((EXISTS ( SELECT 1
   FROM farms f
  WHERE ((f.id = daily_notes.farm_id) AND (f.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert conditions for their analyses" ON "public"."detected_conditions"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM image_analyses
  WHERE ((image_analyses.id = detected_conditions.analysis_id) AND (image_analyses.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view conditions from their analyses" ON "public"."detected_conditions"
  USING ((EXISTS ( SELECT 1
   FROM image_analyses
  WHERE ((image_analyses.id = detected_conditions.analysis_id) AND (image_analyses.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert risk assessments for their farms" ON "public"."disease_risk_assessments"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = disease_risk_assessments.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view risk assessments for their farms" ON "public"."disease_risk_assessments"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = disease_risk_assessments.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can access expense records for their farms" ON "public"."expense_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = expense_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete expense records for their farms" ON "public"."expense_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = expense_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert expense records for their farms" ON "public"."expense_records"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = expense_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update expense records for their farms" ON "public"."expense_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = expense_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their farm expense records" ON "public"."expense_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = expense_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete own farm seasons" ON "public"."farm_seasons"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert own farm seasons" ON "public"."farm_seasons"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can read own farm seasons" ON "public"."farm_seasons"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can update own farm seasons" ON "public"."farm_seasons"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can manage their own AI profiles" ON "public"."farmer_ai_profiles"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "farmer_invitations_insert_authenticated" ON "public"."farmer_invitations"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "farmer_invitations_select_for_members" ON "public"."farmer_invitations"
  USING ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = farmer_invitations.organization_id) AND (om.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete their own farms" ON "public"."farms"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own farms" ON "public"."farms"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own farms" ON "public"."farms"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own farms" ON "public"."farms"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Farm owners can view plan items" ON "public"."fertilizer_plan_items"
  USING ((plan_id IN ( SELECT fp.id
   FROM (fertilizer_plans fp
     JOIN farms f ON ((fp.farm_id = f.id)))
  WHERE (f.user_id = (select auth.uid())))));

ALTER POLICY "Org members can manage plan items" ON "public"."fertilizer_plan_items"
  USING ((plan_id IN ( SELECT fp.id
   FROM (fertilizer_plans fp
     JOIN organization_members om ON ((fp.organization_id = om.organization_id)))
  WHERE (om.user_id = (select auth.uid())))));

ALTER POLICY "Farm owners can view their plans" ON "public"."fertilizer_plans"
  USING ((farm_id IN ( SELECT farms.id
   FROM farms
  WHERE (farms.user_id = (select auth.uid())))));

ALTER POLICY "Org members can manage client farm plans" ON "public"."fertilizer_plans"
  USING ((organization_id IN ( SELECT om.organization_id
   FROM organization_members om
  WHERE (om.user_id = (select auth.uid())))));

ALTER POLICY "Users can access harvest records for their farms" ON "public"."harvest_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = harvest_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete harvest records for their farms" ON "public"."harvest_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = harvest_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert harvest records for their farms" ON "public"."harvest_records"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = harvest_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update harvest records for their farms" ON "public"."harvest_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = harvest_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their farm harvest records" ON "public"."harvest_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = harvest_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete their own image analyses" ON "public"."image_analyses"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own image analyses" ON "public"."image_analyses"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own image analyses" ON "public"."image_analyses"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own image analyses" ON "public"."image_analyses"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Authenticated users can access market data" ON "public"."market_intelligence"
  USING (((select auth.role()) = 'authenticated'::text));

ALTER POLICY "Users can insert maturity assessments for their farms" ON "public"."maturity_assessments"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = maturity_assessments.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view maturity assessments for their farms" ON "public"."maturity_assessments"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = maturity_assessments.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "org_members_insert_authenticated" ON "public"."organization_members"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "org_members_select_own" ON "public"."organization_members"
  USING ((user_id = (select auth.uid())));

ALTER POLICY "organizations_insert_authenticated" ON "public"."organizations"
  WITH CHECK (((select auth.uid()) IS NOT NULL));

ALTER POLICY "Users can see predictions for their farms" ON "public"."pest_disease_predictions"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = pest_disease_predictions.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Consultants can view client petiole tests" ON "public"."petiole_test_records"
  USING ((EXISTS ( SELECT 1
   FROM ((farms f
     JOIN profiles p ON ((p.id = f.user_id)))
     JOIN organization_members om ON ((om.organization_id = p.consultant_organization_id)))
  WHERE ((f.id = petiole_test_records.farm_id) AND (om.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete petiole test records for their farms" ON "public"."petiole_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = petiole_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert petiole test records for their farms" ON "public"."petiole_test_records"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = petiole_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update petiole test records for their farms" ON "public"."petiole_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = petiole_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their farm petiole test records" ON "public"."petiole_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = petiole_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Organizations can view their clients" ON "public"."profiles"
  USING ((consultant_organization_id IN ( SELECT organization_members.organization_id
   FROM organization_members
  WHERE (organization_members.user_id = (select auth.uid())))));

ALTER POLICY "Users can view own profile" ON "public"."profiles"
  USING (((select auth.uid()) = id));

ALTER POLICY "profiles_insert_own" ON "public"."profiles"
  WITH CHECK ((id = (select auth.uid())));

ALTER POLICY "profiles_select_own" ON "public"."profiles"
  USING ((id = (select auth.uid())));

ALTER POLICY "profiles_update_own" ON "public"."profiles"
  USING ((id = (select auth.uid())));

ALTER POLICY "Users can access their own profitability data" ON "public"."profitability_analyses"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "season inference audit select own farm" ON "public"."season_inference_audit"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = season_inference_audit.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete their soil profiles" ON "public"."soil_profiles"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_profiles.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert soil profiles" ON "public"."soil_profiles"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_profiles.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update their soil profiles" ON "public"."soil_profiles"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_profiles.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their soil profiles" ON "public"."soil_profiles"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_profiles.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Consultants can view client soil tests" ON "public"."soil_test_records"
  USING ((EXISTS ( SELECT 1
   FROM ((farms f
     JOIN profiles p ON ((p.id = f.user_id)))
     JOIN organization_members om ON ((om.organization_id = p.consultant_organization_id)))
  WHERE ((f.id = soil_test_records.farm_id) AND (om.user_id = (select auth.uid()))))));

ALTER POLICY "Users can access soil test records for their farms" ON "public"."soil_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete soil test records for their farms" ON "public"."soil_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert soil test records for their farms" ON "public"."soil_test_records"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update soil test records for their farms" ON "public"."soil_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their farm soil test records" ON "public"."soil_test_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = soil_test_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can access spray records for their farms" ON "public"."spray_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = spray_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete spray records for their farms" ON "public"."spray_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = spray_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert spray records for their farms" ON "public"."spray_records"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = spray_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update spray records for their farms" ON "public"."spray_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = spray_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their farm spray records" ON "public"."spray_records"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = spray_records.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete their own spray windows" ON "public"."spray_windows"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own spray windows" ON "public"."spray_windows"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own spray windows" ON "public"."spray_windows"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own spray windows" ON "public"."spray_windows"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can access task reminders for their farms" ON "public"."task_reminders"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete farm tasks" ON "public"."task_reminders"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete task reminders for their farms" ON "public"."task_reminders"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert farm tasks" ON "public"."task_reminders"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert task reminders for their farms" ON "public"."task_reminders"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update farm tasks" ON "public"."task_reminders"
  USING (((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))) OR (assigned_to_user_id = (select auth.uid()))))
  WITH CHECK (((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))) OR (assigned_to_user_id = (select auth.uid()))));

ALTER POLICY "Users can update task reminders for their farms" ON "public"."task_reminders"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view farm tasks" ON "public"."task_reminders"
  USING (((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))) OR (assigned_to_user_id = (select auth.uid()))));

ALTER POLICY "Users can view their farm task reminders" ON "public"."task_reminders"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = task_reminders.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete own temporary workers" ON "public"."temporary_worker_entries"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert temporary workers" ON "public"."temporary_worker_entries"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update own temporary workers" ON "public"."temporary_worker_entries"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can view own temporary workers" ON "public"."temporary_worker_entries"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "guided tour state insert own" ON "public"."user_guided_tour_state"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "guided tour state select own" ON "public"."user_guided_tour_state"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "guided tour state update own" ON "public"."user_guided_tour_state"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "push devices delete own" ON "public"."user_push_devices"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "push devices insert own" ON "public"."user_push_devices"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "push devices select own" ON "public"."user_push_devices"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "push devices update own" ON "public"."user_push_devices"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can delete their own warehouse items" ON "public"."warehouse_items"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert their own warehouse items" ON "public"."warehouse_items"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update their own warehouse items" ON "public"."warehouse_items"
  USING (((select auth.uid()) = user_id))
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can view their own warehouse items" ON "public"."warehouse_items"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view weather data for their farms" ON "public"."weather_data"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = weather_data.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view forecasts for their farms" ON "public"."weather_forecasts"
  USING ((EXISTS ( SELECT 1
   FROM farms
  WHERE ((farms.id = weather_forecasts.farm_id) AND (farms.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete own work types" ON "public"."work_types"
  USING ((((select auth.uid()) = user_id) AND (is_default = false)));

ALTER POLICY "Users can insert own work types" ON "public"."work_types"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update own work types" ON "public"."work_types"
  USING ((((select auth.uid()) = user_id) AND (is_default = false)));

ALTER POLICY "Users can view default and own work types" ON "public"."work_types"
  USING (((user_id IS NULL) OR ((select auth.uid()) = user_id)));

ALTER POLICY "Users can delete their own worker attendance" ON "public"."worker_attendance"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_attendance.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert their own worker attendance" ON "public"."worker_attendance"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_attendance.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update their own worker attendance" ON "public"."worker_attendance"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_attendance.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view their own worker attendance" ON "public"."worker_attendance"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_attendance.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete settlements for own workers" ON "public"."worker_settlements"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_settlements.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert settlements for own workers" ON "public"."worker_settlements"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_settlements.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update settlements for own workers" ON "public"."worker_settlements"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_settlements.worker_id) AND (workers.user_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_settlements.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view settlements for own workers" ON "public"."worker_settlements"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_settlements.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete transactions for own workers" ON "public"."worker_transactions"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_transactions.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can insert transactions for own workers" ON "public"."worker_transactions"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_transactions.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can update transactions for own workers" ON "public"."worker_transactions"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_transactions.worker_id) AND (workers.user_id = (select auth.uid()))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_transactions.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can view transactions for own workers" ON "public"."worker_transactions"
  USING ((EXISTS ( SELECT 1
   FROM workers
  WHERE ((workers.id = worker_transactions.worker_id) AND (workers.user_id = (select auth.uid()))))));

ALTER POLICY "Users can delete own workers" ON "public"."workers"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can insert own workers" ON "public"."workers"
  WITH CHECK (((select auth.uid()) = user_id));

ALTER POLICY "Users can update own workers" ON "public"."workers"
  USING (((select auth.uid()) = user_id));

ALTER POLICY "Users can view own workers" ON "public"."workers"
  USING (((select auth.uid()) = user_id));
