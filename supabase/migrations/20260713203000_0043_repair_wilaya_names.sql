-- Repair Wilaya labels that were imported with the wrong text encoding.
-- Matching by stable code preserves IDs, coverage state, and every foreign key.
BEGIN;

WITH canonical(code, name_en, name_fr, name_ar) AS (
  VALUES
    ('ADR', 'Adrar', 'Adrar', 'أدرار'),
    ('CHL', 'Chlef', 'Chlef', 'الشلف'),
    ('LAG', 'Laghouat', 'Laghouat', 'الأغواط'),
    ('OEB', 'Oum El Bouaghi', 'Oum El Bouaghi', 'أم البواقي'),
    ('BAT', 'Batna', 'Batna', 'باتنة'),
    ('BJA', 'Béjaïa', 'Béjaïa', 'بجاية'),
    ('BIS', 'Biskra', 'Biskra', 'بسكرة'),
    ('BEC', 'Béchar', 'Béchar', 'بشار'),
    ('BLI', 'Blida', 'Blida', 'البليدة'),
    ('BOU', 'Bouira', 'Bouira', 'البويرة'),
    ('TAM', 'Tamanrasset', 'Tamanrasset', 'تمنراست'),
    ('TEB', 'Tébessa', 'Tébessa', 'تبسة'),
    ('TLE', 'Tlemcen', 'Tlemcen', 'تلمسان'),
    ('TIA', 'Tiaret', 'Tiaret', 'تيارت'),
    ('TIZ', 'Tizi Ouzou', 'Tizi Ouzou', 'تيزي وزو'),
    ('ALG', 'Algiers', 'Alger', 'الجزائر'),
    ('DJE', 'Djelfa', 'Djelfa', 'الجلفة'),
    ('JIJ', 'Jijel', 'Jijel', 'جيجل'),
    ('SET', 'Sétif', 'Sétif', 'سطيف'),
    ('SAI', 'Saïda', 'Saïda', 'سعيدة'),
    ('SKI', 'Skikda', 'Skikda', 'سكيكدة'),
    ('SBA', 'Sidi Bel Abbès', 'Sidi Bel Abbès', 'سيدي بلعباس'),
    ('ANN', 'Annaba', 'Annaba', 'عنابة'),
    ('GUE', 'Guelma', 'Guelma', 'قالمة'),
    ('CON', 'Constantine', 'Constantine', 'قسنطينة'),
    ('MED', 'Médéa', 'Médéa', 'المدية'),
    ('MOS', 'Mostaganem', 'Mostaganem', 'مستغانم'),
    ('MSI', 'M''Sila', 'M''Sila', 'المسيلة'),
    ('MAS', 'Mascara', 'Mascara', 'معسكر'),
    ('OUA', 'Ouargla', 'Ouargla', 'ورقلة'),
    ('ORA', 'Oran', 'Oran', 'وهران'),
    ('EBA', 'El Bayadh', 'El Bayadh', 'البيض'),
    ('ILL', 'Illizi', 'Illizi', 'إليزي'),
    ('BBA', 'Bordj Bou Arréridj', 'Bordj Bou Arréridj', 'برج بوعريريج'),
    ('BOM', 'Boumerdès', 'Boumerdès', 'بومرداس'),
    ('ETA', 'El Tarf', 'El Tarf', 'الطارف'),
    ('TIN', 'Tindouf', 'Tindouf', 'تندوف'),
    ('TIS', 'Tissemsilt', 'Tissemsilt', 'تيسمسيلت'),
    ('ELO', 'El Oued', 'El Oued', 'الوادي'),
    ('KHE', 'Khenchela', 'Khenchela', 'خنشلة'),
    ('SAH', 'Souk Ahras', 'Souk Ahras', 'سوق أهراس'),
    ('TIP', 'Tipaza', 'Tipaza', 'تيبازة'),
    ('MIL', 'Mila', 'Mila', 'ميلة'),
    ('ADF', 'Aïn Defla', 'Aïn Defla', 'عين الدفلة'),
    ('NAA', 'Naâma', 'Naâma', 'النعامة'),
    ('ATE', 'Aïn Témouchent', 'Aïn Témouchent', 'عين تموشنت'),
    ('GHA', 'Ghardaïa', 'Ghardaïa', 'غرداية'),
    ('REL', 'Relizane', 'Relizane', 'غليزان'),
    ('TIM', 'Timimoun', 'Timimoun', 'تيميمون'),
    ('BBM', 'Bordj Badji Mokhtar', 'Bordj Badji Mokhtar', 'برج باجي مختار'),
    ('ODJ', 'Ouled Djellal', 'Ouled Djellal', 'أولاد جلال'),
    ('BNA', 'Béni Abbès', 'Béni Abbès', 'بني عباس'),
    ('INS', 'In Salah', 'In Salah', 'عين صالح'),
    ('ING', 'In Guezzam', 'In Guezzam', 'عين قزام'),
    ('TOU', 'Touggourt', 'Touggourt', 'تقرت'),
    ('DJA', 'Djanet', 'Djanet', 'جانت'),
    ('EMG', 'El M''Ghair', 'El M''Ghair', 'المغير'),
    ('EMN', 'El Meniaa', 'El Meniaa', 'المنيعة')
)
UPDATE public.wilayas AS wilaya
SET
  name_en = canonical.name_en,
  name_fr = canonical.name_fr,
  name_ar = canonical.name_ar,
  updated_at = now()
FROM canonical
WHERE wilaya.code = canonical.code
  AND (wilaya.name_en, wilaya.name_fr, wilaya.name_ar)
      IS DISTINCT FROM (canonical.name_en, canonical.name_fr, canonical.name_ar);

COMMIT;
