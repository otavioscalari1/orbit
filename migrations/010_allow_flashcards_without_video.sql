BEGIN;

-- Flashcards também podem ser criados direto na aba Revisão, sem vir das notas de um vídeo.
-- video_id nulo = flashcard criado à mão. A sincronização das notas só mexe nos flashcards do
-- vídeo que está sendo salvo, então os criados à mão nunca são apagados por ela.
ALTER TABLE flashcards
    ALTER COLUMN video_id DROP NOT NULL;

-- O UNIQUE (video_id, question_key) não vale quando video_id é nulo: no banco, nulos nunca são
-- considerados iguais. Este índice impede a mesma pergunta duas vezes entre os criados à mão.
CREATE UNIQUE INDEX flashcards_manual_user_id_question_key_unique
    ON flashcards (user_id, question_key)
    WHERE video_id IS NULL;

COMMIT;
