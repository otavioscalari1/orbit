BEGIN;

-- Bloco de notas de cada vídeo: o que o aluno escreve enquanto assiste.
-- Vazio ('') quando o aluno ainda não escreveu nada. Limite de 200.000 caracteres.
ALTER TABLE videos
    ADD COLUMN notes text NOT NULL DEFAULT '';

ALTER TABLE videos
    ADD CONSTRAINT videos_notes_max_length CHECK (char_length(notes) <= 200000);

COMMIT;
