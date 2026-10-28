BEGIN;

-- Elementos editáveis de cada folha da Lousa: imagens, caixas de texto e formas (seta, quadrado...).
-- Ficam separados dos traços à mão (strokes) porque podem ser selecionados, movidos e redimensionados.
ALTER TABLE note_pages
    ADD COLUMN elements jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE note_pages
    ADD CONSTRAINT note_pages_elements_is_array CHECK (jsonb_typeof(elements) = 'array');

-- Imagens coladas ou importadas nas anotações (o arquivo em si, guardado no banco).
-- Os elementos de imagem em note_pages.elements apontam para o id daqui.
CREATE TABLE note_images (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id    uuid        NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    mime_type  text        NOT NULL,
    data       bytea       NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT note_images_mime_type_valid CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    -- Até 8 MB por imagem (o app já reduz as imagens antes de enviar)
    CONSTRAINT note_images_size_limit CHECK (octet_length(data) BETWEEN 1 AND 8388608)
);

CREATE INDEX note_images_note_id_idx ON note_images (note_id);

COMMIT;
