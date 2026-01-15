import { test, expect } from '@playwright/test';

test('deve permitir adicionar produto e ir para o checkout', async ({ page }) => {
  await page.goto('/');
  
  // Verifica verificação de idade
  await page.click('text=SIM, TENHO +18 ANOS');
  
  // Adiciona primeiro produto visível
  await page.click('button:has-text("Adicionar")');
  
  // Abre carrinho e vai para checkout
  await page.click('[aria-label="Carrinho"]');
  await page.click('text=Finalizar Compra');
  
  // Deve redirecionar para login se não estiver autenticado
  await expect(page).toHaveURL(/.*login/);
});