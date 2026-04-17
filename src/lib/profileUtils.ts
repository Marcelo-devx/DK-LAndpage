/**
 * Verifica se o perfil do usuário está completamente preenchido.
 * Um perfil completo exige: nome, sobrenome, telefone, CPF/CNPJ,
 * e todos os campos de endereço (CEP, rua, número, bairro, cidade, estado).
 *
 * Use esta função em TODOS os lugares que precisam redirecionar para /complete-profile,
 * para garantir consistência em toda a aplicação.
 */
export function isProfileComplete(profile: Record<string, any> | null | undefined): boolean {
  if (!profile) return false;
  return !!(
    profile.first_name &&
    profile.last_name &&
    profile.phone &&
    profile.cpf_cnpj &&
    profile.cep &&
    profile.street &&
    profile.number &&
    profile.neighborhood &&
    profile.city &&
    profile.state
  );
}
