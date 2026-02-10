# 🚀 Instruções para Deploy no GitHub

## Passo 1: Criar o repositório no GitHub

1. Acesse: https://github.com/new
2. **Repository name**: `buscador-unespar`
3. **Description**: "Sistema de busca de ARPs (Ata de Registro de Preços) da UNESPAR com sugestões inteligentes de PDM"
4. **Visibilidade**: Public ou Private (sua escolha)
5. ⚠️ **NÃO marque** "Add a README file" 
6. ⚠️ **NÃO marque** "Add .gitignore"
7. Clique em **Create repository**

## Passo 2: Fazer o Push do código

Execute no terminal:

```bash
cd /home/juscelinot/buscadorUnespar/react-api-table
git push -u origin main
```

Se pedir autenticação:
- **Username**: iwill2005
- **Password**: Use um **Personal Access Token** (não a senha normal)

### Como criar um Personal Access Token:
1. Acesse: https://github.com/settings/tokens
2. Clique em **Generate new token** → **Generate new token (classic)**
3. Nome: "buscador-unespar"
4. Marque: `repo` (acesso completo)
5. Clique em **Generate token**
6. **COPIE O TOKEN** (você não verá ele novamente!)
7. Use esse token como senha no `git push`

## ✅ Pronto!

Depois do push, acesse:
**https://github.com/iwill2005/buscador-unespar**

---

## 📦 Recursos do Projeto

✅ Busca de ARPs por palavra-chave  
✅ Sugestões inteligentes de código PDM (API SERPRO)  
✅ 16 filtros avançados  
✅ Paginação de sugestões (6 por página, até 3 páginas)  
✅ Cache completo com IndexedDB  
✅ Exportação para Excel  
✅ Interface UNESPAR (cores e logo oficial)  
✅ Tabela com scroll duplo sincronizado  
✅ Ordenação por todas as colunas  

## 🛠️ Tecnologias

- React 18 + TypeScript
- Vite 8
- TanStack Query (React Query)
- XLSX (SheetJS)
- IndexedDB
- Axios
