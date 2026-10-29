BEGIN;

-- Biblioteca de vídeos do YouTube de cada usuário (o aluno cola o link do vídeo).
-- youtube_id = o código de 11 caracteres do vídeo (ex.: "dQw4w9WgXcQ").
-- title e channel_name vêm do YouTube no momento em que o vídeo é adicionado.
CREATE TABLE videos (
    id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    youtube_id   text        NOT NULL,
    title        text        NOT NULL,
    channel_name text,
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT videos_youtube_id_format CHECK (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
    CONSTRAINT videos_title_not_blank CHECK (length(trim(title)) > 0),
    -- O mesmo vídeo não entra duas vezes na biblioteca do mesmo usuário
    CONSTRAINT videos_user_id_youtube_id_unique UNIQUE (user_id, youtube_id)
);

COMMIT;
