BEGIN;

-- Flashcards gerados automaticamente das notas dos vídeos (linhas "pergunta :: resposta").
-- O backend cria, atualiza e remove os flashcards sempre que a nota do vídeo é salva.
-- question_key = pergunta normalizada (minúsculas, sem espaços extras): identifica o flashcard
-- entre uma edição e outra da nota, para não perder o progresso de revisão ao mudar só a resposta.
-- video_seconds = momento do vídeo em que a linha foi marcada ([12:34]), se tiver.
--
-- Repetição espaçada (SM-2 simplificado):
--   due_at        = a partir de quando o flashcard deve ser revisado
--   interval_days = intervalo atual entre revisões, em dias
--   ease_factor   = "facilidade" do flashcard (quanto o intervalo cresce a cada acerto)
--   repetitions   = acertos seguidos; lapses = quantas vezes errou
CREATE TABLE flashcards (
    id               uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          uuid             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    video_id         uuid             NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
    question         text             NOT NULL,
    answer           text             NOT NULL,
    question_key     text             NOT NULL,
    video_seconds    integer,
    due_at           timestamptz      NOT NULL DEFAULT now(),
    interval_days    integer          NOT NULL DEFAULT 0,
    ease_factor      double precision NOT NULL DEFAULT 2.5,
    repetitions      integer          NOT NULL DEFAULT 0,
    lapses           integer          NOT NULL DEFAULT 0,
    last_reviewed_at timestamptz,
    created_at       timestamptz      NOT NULL DEFAULT now(),
    updated_at       timestamptz      NOT NULL DEFAULT now(),

    CONSTRAINT flashcards_question_not_blank CHECK (length(trim(question)) > 0),
    CONSTRAINT flashcards_answer_not_blank CHECK (length(trim(answer)) > 0),
    CONSTRAINT flashcards_video_seconds_not_negative CHECK (video_seconds IS NULL OR video_seconds >= 0),
    CONSTRAINT flashcards_interval_days_not_negative CHECK (interval_days >= 0),
    CONSTRAINT flashcards_ease_factor_range CHECK (ease_factor BETWEEN 1.3 AND 5.0),
    CONSTRAINT flashcards_counters_not_negative CHECK (repetitions >= 0 AND lapses >= 0),
    -- A mesma pergunta não vira dois flashcards no mesmo vídeo
    CONSTRAINT flashcards_video_id_question_key_unique UNIQUE (video_id, question_key)
);

-- Busca rápida dos flashcards que vencem até hoje
CREATE INDEX flashcards_user_id_due_at_idx ON flashcards (user_id, due_at);

COMMIT;
