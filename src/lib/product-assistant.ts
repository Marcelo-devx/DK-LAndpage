import type { AssistantProduct, AssistantVariant } from '@/hooks/use-assistant-products';

export const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const restrictedTopic = /\b(pag\w*|preco\w*|valor\w*|pix|boleto\w*|cartao\w*|credito\w*|debito\w*|parcel\w*|cobr\w*|assinatura\w*|reembolso\w*|estorno\w*|cupom\w*|cupons|desconto\w*|frete\w*|checkout|acess\w*|login\w*|senha\w*|conta\w*|permiss\w*|liber\w*|bloque\w*|autentic\w*|entrar|pedido\w*|entrega\w*)\b/;
export const outOfScope = 'Essa parte fica com o suporte da loja, tá? Por aqui eu ajudo você a conhecer os produtos. Não consigo tratar de pagamento, pedidos ou acesso à conta.';
const currency = /(?:R\$|US\$|\$|€|£)/i;
export const safeText = (text: string) => !restrictedTopic.test(normalize(text)) && !currency.test(text);
export const plainDescription = (product: AssistantProduct) => product.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';

export const variantLabel = (variant: AssistantVariant) => [variant.flavor_name, variant.color, variant.size, variant.ohms, variant.volume_ml ? `${variant.volume_ml}ml` : null].filter((value): value is string => !!value && safeText(value)).join(' · ') || 'Variação';
export const productAvailable = (product: AssistantProduct) => product.variants.length ? product.variants.some(variant => variant.stock_quantity > 0) : product.stock_quantity > 0;

export function productInformation(product: AssistantProduct, variant?: AssistantVariant): string {
  const description = plainDescription(product);
  const available = variant ? variant.stock_quantity > 0 : productAvailable(product);
  return [
    product.name,
    variant ? `${variant.flavor_name ? 'Sabor' : 'Opção'}: ${variantLabel(variant)}` : '',
    available ? 'Disponível em estoque.' : 'Esgotado no momento. Você pode pedir um aviso quando voltar ao estoque.',
    product.category && safeText(product.category) ? `Categoria: ${product.category}` : '',
    product.sub_category && safeText(product.sub_category) ? `Tipo: ${product.sub_category}` : '',
    product.brand && safeText(product.brand) ? `Marca: ${product.brand}` : '',
    description && safeText(description) ? `Sobre ele: ${description}` : 'O catálogo não traz mais detalhes de uso. Confira as orientações do fabricante.',
  ].filter(Boolean).join('\n\n');
}

const ignoredWords = new Set('qual quais o a os as um uma uns umas de da das do dos e ou em na no nas nos com para por que eu me voce voces quero queria gostaria pode poderia consegue mostrar mostre mostra encontrar encontre procurando procuro buscando busco busca buscar conhecer saber ver veja tem tenho ter ha existe existem produto produtos item itens marca marcas categoria categorias tipo tipos sobre favor porfavor ai ae esse essa esses essas este esta estes estas disso dele dela mais muito melhor melhores bom boa bons boas vendido vendidos vendida vendidas vende vendem vender vendas sai saem saida sai sai popular populares procurado procurados campeao campeoes sucesso recomendacao recomendacoes recomenda recomendar recomende indica indicar indique sugestao sugestoes sugere sugerir parecido parecidos parecida parecidas semelhante semelhantes similar similares relacionado relacionados alternativa alternativas outro outros outra outras tambem uso usar utiliza utilizar funciona funcionar como detalhes detalhe informacoes informacao descricao descrever explique explicar ajuda ajudar todos tudo catalogo disponivel disponiveis loja aqui entao pra pro comprar compro comprando adquirir pegar levar preciso precisava necessito estou to tava queria'.split(' '));
const aliases: Record<string, string> = { pods: 'pod', juice: 'juices', liquido: 'juices', liquidos: 'juices', atomizador: 'atomizadores', refis: 'refil', descartavel: 'descartaveis', recarregavel: 'recarregaveis', bala: 'balas', melancia: 'watermelon', morango: 'strawberry', uva: 'grape', cereja: 'cherry', menta: 'mint', hortela: 'mint', abacaxi: 'pineapple', pessego: 'peach', maca: 'apple', gelado: 'ice' };
const canonical = (term: string) => term === 'coils' ? 'coil' : aliases[term] || term;
const words = (text: string) => normalize(text).replace(/(\d+)\s+ml\b/g, '$1ml').split(/[^a-z0-9]+/).filter(Boolean).map(canonical);
const queryTerms = (text: string) => words(text).filter(term => !ignoredWords.has(term) && !['sabor', 'sabores', 'variante', 'variantes', 'opcao', 'opcoes', 'estoque', 'esgotado', 'esgotados', 'nesse', 'neste', 'deste', 'desse', 'desses', 'dessas', 'destes', 'destas', 'dessa', 'desta', 'deles', 'delas', 'mande', 'manda', 'mandar', 'envie', 'envia', 'enviar', 'link', 'links', 'pagina', 'paginas', 'site', 'abrir', 'abra', 'visitar', 'ir', 'subcategoria', 'subcategorias', 'agora', 'vez', 'trocar', 'troque', 'mudar', 'mudando', 'assunto'].includes(term));

export function matchingVariants(text: string, product: AssistantProduct): AssistantVariant[] {
  const terms = queryTerms(text);
  const allTokens = product.variants.flatMap(variant => words(variantLabel(variant)));
  const variantTerms = terms.filter(term => allTokens.includes(term));
  return variantTerms.length ? product.variants.filter(variant => {
    const tokens = words(variantLabel(variant));
    return variantTerms.every(term => tokens.includes(term));
  }) : [];
}

// Tolera um único erro de digitação; não atribui características que não estão no catálogo.
function nearWord(left: string, right: string): boolean {
  if (left === right) return true;
  if (left.length < 4 || right.length < 4 || Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let differences = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++differences > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  return differences + (left.length - i) + (right.length - j) <= 1;
}

export type ProductIntent = 'bestsellers' | 'related' | 'details' | 'recommend' | 'search';
export function parseProductQuestion(text: string, products: AssistantProduct[]) {
  const normalized = normalize(text);
  const intent: ProductIntent = /mais\s+(?:\w+\s+)?(?:vend\w*|sai\b|saem\b|saida\w*|popular\w*|procurad\w*)|\b(?:campeao|campeoes|best.?seller|top vendas)\b/.test(normalized)
    ? 'bestsellers'
    : /\b(parecid\w*|semelhant\w*|similar\w*|relacionad\w*|alternativa\w*)\b/.test(normalized)
      ? 'related'
      : /\b(usar|uso|utiliz\w*|funciona\w*|descricao|detalhes|informacoes|explique)\b/.test(normalized)
        ? 'details'
        : /\b(recomend\w*|indic\w*|sugest\w*|melhor\w*|sugere)\b/.test(normalized) ? 'recommend' : 'search';
  const terms = queryTerms(text);
  const questionWords = ` ${words(text).join(' ')} `;
  const mentionedBrands = [...new Set(products.map(product => product.brand).filter((brand): brand is string => !!brand))]
    .filter(brand => questionWords.includes(` ${words(brand).join(' ')} `));
  const candidates = mentionedBrands.length === 1 ? products.filter(product =>
    normalize(product.brand || '') === normalize(mentionedBrands[0])
    || ` ${words(product.name).join(' ')} `.includes(` ${words(mentionedBrands[0]).join(' ')} `)) : products;
  const indexed = candidates.map(product => {
    const description = plainDescription(product);
    return { product, tokens: words([product.name, product.brand, product.category, product.sub_category, ...product.sub_categories, safeText(description) ? description : '', ...product.variants.map(variantLabel)].filter(Boolean).join(' ')) };
  });
  const exactMatches = indexed.filter(({ tokens }) => terms.every(term => tokens.some(token => token === term || (term.length >= 3 && token.startsWith(term)))));
  const matches = !terms.length ? candidates : (exactMatches.length ? exactMatches : indexed.filter(({ tokens }) => terms.every(term => tokens.some(token => nearWord(term, token))))).map(({ product }) => product);
  return { intent, matches, hasTerms: terms.length > 0 };
}

export function relatedProducts(product: AssistantProduct, products: AssistantProduct[]): AssistantProduct[] {
  return products.filter(candidate => candidate.id !== product.id).map(candidate => ({
    product: candidate,
    score: (product.sub_category && candidate.sub_category === product.sub_category ? 4 : 0)
      + (product.category && candidate.category === product.category ? 3 : 0)
      + (product.brand && candidate.brand === product.brand ? 2 : 0),
  })).filter(candidate => candidate.score > 0).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name)).map(candidate => candidate.product);
}
