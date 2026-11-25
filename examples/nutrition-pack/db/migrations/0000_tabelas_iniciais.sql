CREATE TABLE "allergens" (
	"code" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_allergens" (
	"food_key" text NOT NULL,
	"allergen_code" text NOT NULL,
	CONSTRAINT "food_allergens_food_key_allergen_code_pk" PRIMARY KEY("food_key","allergen_code")
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"kcal_per_100g" double precision NOT NULL,
	"source" text DEFAULT 'synthetic' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"recipe_id" text NOT NULL,
	"position" integer NOT NULL,
	"food_key" text NOT NULL,
	"grams" double precision NOT NULL,
	CONSTRAINT "recipe_ingredients_recipe_id_position_pk" PRIMARY KEY("recipe_id","position")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"instructions" text NOT NULL,
	"servings" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_allergens" ADD CONSTRAINT "food_allergens_food_key_foods_key_fk" FOREIGN KEY ("food_key") REFERENCES "public"."foods"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_allergens" ADD CONSTRAINT "food_allergens_allergen_code_allergens_code_fk" FOREIGN KEY ("allergen_code") REFERENCES "public"."allergens"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_food_key_foods_key_fk" FOREIGN KEY ("food_key") REFERENCES "public"."foods"("key") ON DELETE no action ON UPDATE no action;