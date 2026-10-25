BEGIN;

-- Eventos do calendário (provas, trabalhos, entregas, compromissos...).
-- Sem horário (start_time nulo) = evento de dia inteiro.
CREATE TABLE events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title       text        NOT NULL,
    description text,
    event_date  date        NOT NULL,
    start_time  time,
    end_time    time,
    color       text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT events_title_not_blank CHECK (length(trim(title)) > 0),
    CONSTRAINT events_color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    -- Só pode ter horário de fim se tiver horário de início, e o fim vem depois do início
    CONSTRAINT events_end_requires_start CHECK (end_time IS NULL OR start_time IS NOT NULL),
    CONSTRAINT events_time_order CHECK (end_time IS NULL OR end_time > start_time)
);

-- Busca rápida dos eventos de um usuário em um período (ex.: um mês)
CREATE INDEX events_user_id_event_date_idx ON events (user_id, event_date);

COMMIT;
