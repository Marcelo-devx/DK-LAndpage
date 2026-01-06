-- Update profiles where critical fields are null or empty strings
UPDATE public.profiles
SET
    first_name = COALESCE(first_name, 'Cliente'),
    last_name = COALESCE(last_name, 'Imperial'),
    phone = COALESCE(phone, '48999999999'), -- Placeholder phone (SC DDD + 11 digits)
    cep = COALESCE(cep, '80000000'), -- Placeholder CEP (Curitiba)
    street = COALESCE(street, 'Rua Principal'),
    number = COALESCE(number, '100'),
    neighborhood = COALESCE(neighborhood, 'Centro'),
    city = COALESCE(city, 'Curitiba'),
    state = COALESCE(state, 'PR')
WHERE
    first_name IS NULL OR last_name IS NULL OR phone IS NULL OR cep IS NULL OR street IS NULL OR number IS NULL OR neighborhood IS NULL OR city IS NULL OR state IS NULL
    OR first_name = '' OR last_name = '' OR phone = '' OR cep = '' OR street = '' OR number = '' OR neighborhood = '' OR city = '' OR state = '';