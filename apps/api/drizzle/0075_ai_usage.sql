CREATE TABLE "ai_usage" (
	"day" date PRIMARY KEY NOT NULL,
	"chat_calls" integer DEFAULT 0 NOT NULL,
	"embedding_calls" integer DEFAULT 0 NOT NULL
);
