BEGIN;

-- Anotações da Lousa. Cada anotação é um "caderno" com uma ou mais folhas A4.
-- paper_theme = cor da folha: 'light' (branca) ou 'dark' (escura).
CREATE TABLE notes (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       text        NOT NULL,
    paper_theme text        NOT NULL DEFAULT 'light',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT notes_title_not_blank CHECK (length(trim(title)) > 0),
    CONSTRAINT notes_paper_theme_valid CHECK (paper_theme IN ('light', 'dark'))
);

CREATE INDEX notes_user_id_idx ON notes (user_id);

-- Folhas de cada anotação, em ordem (position começa em 0).
-- strokes = traços desenhados na folha, em JSON (lista de { tool, color, size, points }).
CREATE TABLE note_pages (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id    uuid        NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
    position   integer     NOT NULL,
    strokes    jsonb       NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT note_pages_position_not_negative CHECK (position >= 0),
    CONSTRAINT note_pages_strokes_is_array CHECK (jsonb_typeof(strokes) = 'array'),
    -- DEFERRABLE: permite reordenar as folhas (ex.: position = position + 1) num único comando
    CONSTRAINT note_pages_note_id_position_unique UNIQUE (note_id, position) DEFERRABLE INITIALLY IMMEDIATE
);

COMMIT;
