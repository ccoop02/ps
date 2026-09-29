CREATE TYPE "public"."group_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ledger_account" AS ENUM('user', 'platform', 'treasury');--> statement-breakpoint
CREATE TYPE "public"."ledger_reason" AS ENUM('starting_grant', 'trade', 'fee', 'treasury_issue', 'admin_adjust');--> statement-breakpoint
CREATE TYPE "public"."post_type" AS ENUM('text', 'image', 'video');--> statement-breakpoint
CREATE TYPE "public"."price_marker" AS ENUM('listing', 'event', 'rebalance');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'hidden', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."report_target" AS ENUM('post', 'comment', 'trade_note');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('bullish', 'bearish');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('instagram', 'tiktok', 'x', 'threads', 'youtube', 'strava', 'spotify', 'snapchat', 'linkedin', 'letterboxd', 'goodreads', 'other');--> statement-breakpoint
CREATE TYPE "public"."subject_status" AS ENUM('pending', 'listed', 'delisted');--> statement-breakpoint
CREATE TYPE "public"."trade_actor" AS ENUM('user', 'treasury');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('buy', 'sell');--> statement-breakpoint
CREATE TYPE "public"."trade_source" AS ENUM('user', 'listing_seed', 'treasury_score', 'treasury_event');--> statement-breakpoint
CREATE TABLE "basket_items" (
	"basket_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "basket_items_basket_id_subject_id_pk" PRIMARY KEY("basket_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "baskets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" varchar(40) NOT NULL,
	"shared_with_group" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "checkins" (
	"hangout_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkins_hangout_id_profile_id_pk" PRIMARY KEY("hangout_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" varchar(300) NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_layouts" (
	"profile_id" uuid PRIMARY KEY NOT NULL,
	"widgets" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fundamentals" (
	"subject_id" uuid PRIMARY KEY NOT NULL,
	"score" double precision NOT NULL,
	"last_traded_score" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fundamentals_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_members" (
	"group_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" "group_role" DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "group_members_group_id_profile_id_pk" PRIMARY KEY("group_id","profile_id")
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"invite_code" varchar(32) NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "hangouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"title" varchar(100) NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"profile_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"balance_micro" bigint NOT NULL,
	"cost_basis_cents" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_profile_id_subject_id_pk" PRIMARY KEY("profile_id","subject_id"),
	CONSTRAINT "balance_non_negative" CHECK ("holdings"."balance_micro" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"account" "ledger_account" NOT NULL,
	"profile_id" uuid,
	"delta_cents" bigint NOT NULL,
	"reason" "ledger_reason" NOT NULL,
	"trade_id" bigint,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_entries_have_profile" CHECK (("ledger_entries"."account" = 'user') = ("ledger_entries"."profile_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "metric_values" (
	"subject_id" uuid NOT NULL,
	"metric_key" varchar(32) NOT NULL,
	"raw_value" double precision NOT NULL,
	"score" double precision NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metric_values_subject_id_metric_key_pk" PRIMARY KEY("subject_id","metric_key")
);
--> statement-breakpoint
CREATE TABLE "metric_weights" (
	"group_id" uuid NOT NULL,
	"metric_key" varchar(32) NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	CONSTRAINT "metric_weights_group_id_metric_key_pk" PRIMARY KEY("group_id","metric_key")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "peer_votes" (
	"voter_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"score" smallint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "peer_votes_voter_id_subject_id_pk" PRIMARY KEY("voter_id","subject_id"),
	CONSTRAINT "vibe_score_range" CHECK ("peer_votes"."score" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"fees_enabled" boolean DEFAULT true NOT NULL,
	"fee_tiers" jsonb NOT NULL,
	"trading_paused" boolean DEFAULT false NOT NULL,
	"starting_cash_cents" bigint DEFAULT 10000 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "single_row" CHECK ("platform_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "poll_votes" (
	"poll_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "poll_votes_poll_id_voter_id_pk" PRIMARY KEY("poll_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "polls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"question" varchar(140) NOT NULL,
	"created_by" uuid,
	"closes_at" timestamp with time zone NOT NULL,
	"winner_subject_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_sentiment_votes" (
	"post_id" uuid NOT NULL,
	"voter_id" uuid NOT NULL,
	"sentiment" "sentiment" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_sentiment_votes_post_id_voter_id_pk" PRIMARY KEY("post_id","voter_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"type" "post_type" DEFAULT 'text' NOT NULL,
	"body" varchar(500),
	"media_path" text,
	"media_duration_s" smallint,
	"price_at_post_micro_usd" bigint NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_max_60s" CHECK ("posts"."media_duration_s" is null or "posts"."media_duration_s" <= 60)
);
--> statement-breakpoint
CREATE TABLE "price_ticks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_id" uuid NOT NULL,
	"price_micro_usd" bigint NOT NULL,
	"supply_micro" bigint NOT NULL,
	"trade_id" bigint,
	"marker" "price_marker",
	"marker_label" text,
	"ts" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"bio" varchar(160),
	"cash_cents" bigint DEFAULT 0 NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_auth_user_id_unique" UNIQUE("auth_user_id"),
	CONSTRAINT "cash_non_negative" CHECK ("profiles"."cash_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reactions" (
	"post_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"kind" varchar(16) DEFAULT 'like' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_post_id_profile_id_kind_pk" PRIMARY KEY("post_id","profile_id","kind")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" "report_target" NOT NULL,
	"target_id" text NOT NULL,
	"reason" varchar(300),
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"handle" varchar(64),
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "streak_checkins" (
	"streak_id" uuid NOT NULL,
	"day" date NOT NULL,
	"photo_path" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "streak_checkins_streak_id_day_pk" PRIMARY KEY("streak_id","day")
);
--> statement-breakpoint
CREATE TABLE "streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"label" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"ticker" varchar(8) NOT NULL,
	"status" "subject_status" DEFAULT 'pending' NOT NULL,
	"tagline" varchar(120),
	"listed_at" timestamp with time zone,
	"delisted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ticker_format" CHECK ("subjects"."ticker" ~ '^[A-Z0-9]{2,8}$')
);
--> statement-breakpoint
CREATE TABLE "tokens" (
	"subject_id" uuid PRIMARY KEY NOT NULL,
	"supply_micro" bigint NOT NULL,
	"reserve_cents" bigint NOT NULL,
	"offset_micro" bigint NOT NULL,
	"curve_k" bigint NOT NULL,
	"engine_version" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "supply_non_negative" CHECK ("tokens"."supply_micro" >= 0),
	CONSTRAINT "reserve_non_negative" CHECK ("tokens"."reserve_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_id" uuid NOT NULL,
	"actor" "trade_actor" NOT NULL,
	"profile_id" uuid,
	"side" "trade_side" NOT NULL,
	"source" "trade_source" NOT NULL,
	"tokens_micro" bigint NOT NULL,
	"curve_cents" bigint NOT NULL,
	"fee_cents" bigint NOT NULL,
	"fee_bps" integer NOT NULL,
	"total_cents" bigint NOT NULL,
	"avg_price_micro_usd" bigint NOT NULL,
	"price_before_micro_usd" bigint NOT NULL,
	"price_after_micro_usd" bigint NOT NULL,
	"supply_after_micro" bigint NOT NULL,
	"engine_version" text NOT NULL,
	"note" varchar(140),
	"note_hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trade_tokens_positive" CHECK ("trades"."tokens_micro" > 0)
);
--> statement-breakpoint
CREATE TABLE "treasury_holdings" (
	"subject_id" uuid PRIMARY KEY NOT NULL,
	"balance_micro" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "treasury_balance_non_negative" CHECK ("treasury_holdings"."balance_micro" >= 0)
);
--> statement-breakpoint
CREATE TABLE "treasury_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"subject_id" uuid NOT NULL,
	"source" "trade_source" NOT NULL,
	"requested_bps" integer NOT NULL,
	"achieved_bps" integer NOT NULL,
	"trade_id" bigint,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_items" (
	"profile_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"alert_price_move_pct" smallint,
	"alert_new_post" boolean DEFAULT false NOT NULL,
	"alert_new_event" boolean DEFAULT false NOT NULL,
	"alert_event_resolved" boolean DEFAULT false NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watchlist_items_profile_id_subject_id_pk" PRIMARY KEY("profile_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_basket_id_baskets_id_fk" FOREIGN KEY ("basket_id") REFERENCES "public"."baskets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "basket_items" ADD CONSTRAINT "basket_items_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baskets" ADD CONSTRAINT "baskets_owner_id_profiles_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_hangout_id_hangouts_id_fk" FOREIGN KEY ("hangout_id") REFERENCES "public"."hangouts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layouts" ADD CONSTRAINT "dashboard_layouts_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundamentals" ADD CONSTRAINT "fundamentals_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fundamentals_history" ADD CONSTRAINT "fundamentals_history_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangouts" ADD CONSTRAINT "hangouts_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hangouts" ADD CONSTRAINT "hangouts_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_values" ADD CONSTRAINT "metric_values_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_weights" ADD CONSTRAINT "metric_weights_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_votes" ADD CONSTRAINT "peer_votes_voter_id_profiles_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "peer_votes" ADD CONSTRAINT "peer_votes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_profiles_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_poll_id_polls_id_fk" FOREIGN KEY ("poll_id") REFERENCES "public"."polls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_voter_id_profiles_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "polls" ADD CONSTRAINT "polls_winner_subject_id_subjects_id_fk" FOREIGN KEY ("winner_subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sentiment_votes" ADD CONSTRAINT "post_sentiment_votes_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_sentiment_votes" ADD CONSTRAINT "post_sentiment_votes_voter_id_profiles_id_fk" FOREIGN KEY ("voter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_ticks" ADD CONSTRAINT "price_ticks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_ticks" ADD CONSTRAINT "price_ticks_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_profiles_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_profiles_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streak_checkins" ADD CONSTRAINT "streak_checkins_streak_id_streaks_id_fk" FOREIGN KEY ("streak_id") REFERENCES "public"."streaks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_holdings" ADD CONSTRAINT "treasury_holdings_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_ledger" ADD CONSTRAINT "treasury_ledger_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_ledger" ADD CONSTRAINT "treasury_ledger_trade_id_trades_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_post_idx" ON "comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "fundamentals_history_idx" ON "fundamentals_history" USING btree ("subject_id","created_at");--> statement-breakpoint
CREATE INDEX "holdings_subject_idx" ON "holdings" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "ledger_profile_idx" ON "ledger_entries" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_profile_idx" ON "notifications" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "sentiment_votes_updated_idx" ON "post_sentiment_votes" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "posts_subject_time_idx" ON "posts" USING btree ("subject_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_time_idx" ON "posts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "price_ticks_subject_ts_idx" ON "price_ticks" USING btree ("subject_id","ts");--> statement-breakpoint
CREATE INDEX "social_accounts_subject_idx" ON "social_accounts" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_ticker_unique" ON "subjects" USING btree ("ticker");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_profile_group_unique" ON "subjects" USING btree ("profile_id","group_id");--> statement-breakpoint
CREATE INDEX "trades_subject_time_idx" ON "trades" USING btree ("subject_id","created_at");--> statement-breakpoint
CREATE INDEX "trades_profile_time_idx" ON "trades" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "trades_time_idx" ON "trades" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "treasury_ledger_subject_idx" ON "treasury_ledger" USING btree ("subject_id","created_at");