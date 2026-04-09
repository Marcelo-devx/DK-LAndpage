# RESTAURAR CHECKOUTPAGE.TSX

## Execute este comando no terminal:

git checkout HEAD -- src/pages/CheckoutPage.tsx

## Se isso não funcionar, tente:

git log --oneline -n 5 src/pages/CheckoutPage.tsx

# Pegue o hash do commit anterior e execute:

git checkout <hash-do-commit-anterior> -- src/pages/CheckoutPage.tsx

## Depois de restaurar, me avise!
