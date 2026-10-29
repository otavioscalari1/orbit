BEGIN;

-- Pastas para organizar a biblioteca de vídeos (ex.: "Cálculo 1", "Revisão para a P2").
CREATE TABLE video_folders (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT video_folders_name_not_blank CHECK (length(trim(name)) > 0)
);

-- Nome de pasta único por usuário, sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX video_folders_user_id_name_unique ON video_folders (user_id, lower(name));

-- Cada vídeo fica em uma pasta ou em nenhuma (folder_id nulo = "Sem pasta").
-- Excluir a pasta NÃO apaga os vídeos: eles voltam para "Sem pasta".
ALTER TABLE videos
    ADD COLUMN folder_id uuid REFERENCES video_folders (id) ON DELETE SET NULL;

CREATE INDEX videos_folder_id_idx ON videos (folder_id);

COMMIT;
