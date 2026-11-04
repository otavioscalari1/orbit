BEGIN;

-- Currículo do usuário (no máximo um por usuário, por isso o UNIQUE em user_id).
-- content = tudo o que foi preenchido no formulário (contato, formação, experiências...).
-- Fica em jsonb porque o formulário é sempre salvo inteiro e nada busca só uma parte dele.
-- photo = foto opcional, sempre em JPEG: o app recorta e converte a imagem antes de enviar.
CREATE TABLE resumes (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    content    jsonb       NOT NULL DEFAULT '{}'::jsonb,
    photo      bytea,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT resumes_user_id_unique UNIQUE (user_id),
    CONSTRAINT resumes_content_is_object CHECK (jsonb_typeof(content) = 'object'),
    -- Até 2 MB (a foto recortada tem bem menos que isso)
    CONSTRAINT resumes_photo_size_limit CHECK (photo IS NULL OR octet_length(photo) BETWEEN 1 AND 2097152)
);

COMMIT;
