SELECT trigger_event, target_url, is_active 
FROM webhook_configs 
WHERE trigger_event IN ('order_created', 'support_contact_clicked', 'chat_message_sent');