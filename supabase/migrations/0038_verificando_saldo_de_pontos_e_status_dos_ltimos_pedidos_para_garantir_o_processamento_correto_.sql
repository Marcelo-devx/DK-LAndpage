SELECT 
    p.first_name, 
    p.points, 
    o.id as order_id, 
    o.status, 
    o.total_price,
    o.payment_method
FROM public.profiles p
LEFT JOIN public.orders o ON p.id = o.user_id
WHERE p.first_name ILIKE '%teste%' OR p.last_name ILIKE '%teste%'
ORDER BY o.created_at DESC;