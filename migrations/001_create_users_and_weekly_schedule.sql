BEGIN;

-- Usuários do app e suas preferências.
-- day_start_hour/day_end_hour = janela de horário do dia (ex.: 8 às 23), vale para os 7 dias.
-- Ficam nulas até o usuário definir a janela pela primeira vez.
CREATE TABLE users (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text        NOT NULL,
    email          text        NOT NULL,
    day_start_hour smallint,
    day_end_hour   smallint,
    created_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT users_day_start_hour_range CHECK (day_start_hour BETWEEN 0 AND 23),
    CONSTRAINT users_day_end_hour_range CHECK (day_end_hour BETWEEN 1 AND 24),
    -- As duas horas são definidas juntas, e o fim vem depois do início
    CONSTRAINT users_day_window_valid CHECK (
        (day_start_hour IS NULL AND day_end_hour IS NULL)
        OR (day_start_hour IS NOT NULL AND day_end_hour IS NOT NULL AND day_end_hour > day_start_hour)
    )
);

-- E-mail único sem diferenciar maiúsculas/minúsculas
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

-- Aulas e atividades fixas da rotina semanal (ex.: Cálculo 1, das 19:00 às 21:00)
CREATE TABLE classes (
    id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name       text        NOT NULL,
    start_time time        NOT NULL,
    end_time   time        NOT NULL,
    color      text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT classes_name_not_blank CHECK (length(trim(name)) > 0),
    CONSTRAINT classes_time_order CHECK (end_time > start_time),
    CONSTRAINT classes_color_hex CHECK (color ~ '^#[0-9a-fA-F]{6}$')
);

CREATE INDEX classes_user_id_idx ON classes (user_id);

-- Dias da semana em que cada aula acontece (0 = domingo ... 6 = sábado)
CREATE TABLE class_days (
    class_id uuid     NOT NULL REFERENCES classes (id) ON DELETE CASCADE,
    weekday  smallint NOT NULL,

    PRIMARY KEY (class_id, weekday),
    CONSTRAINT class_days_weekday_range CHECK (weekday BETWEEN 0 AND 6)
);

COMMIT;
