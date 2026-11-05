
-- Fix total_installments for all sales that have an entry installment (installment_number=0)
-- The correct total_installments should be the count of non-entry installments (installment_number > 0)
UPDATE installments i
SET total_installments = sub.correct_total
FROM (
  SELECT sale_id, COUNT(*) FILTER (WHERE installment_number > 0) as correct_total
  FROM installments
  WHERE sale_id IN (SELECT DISTINCT sale_id FROM installments WHERE installment_number = 0)
  GROUP BY sale_id
) sub
WHERE i.sale_id = sub.sale_id
  AND i.total_installments != sub.correct_total;
