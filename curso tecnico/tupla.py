import pyfiglet as pyf
import unicodedata as ud

def remover_acentos(txt):
   return "".join(c for c in ud.normalize('NFD', txt) if ud.category(c) != 'Mn')

print(pyf.figlet_format("CASAS BAHIA"))
produtos = [
    ("Notebook", "Eletrônico", 3500.00),
    ("Camisa", "Vestuário", 79.90),
    ("Cadeira Gamer", "Móveis", 899.99),
    ("Smartphone", "Eletrônico", 2500.00),
    ("Tênis", "Vestuário", 299.90),
    ("Geladeira", "Eletrodoméstico", 4200.00),
    ("Livro de Romance", "Livros", 120.00),
    ("Relógio", "Acessórios", 450.00),
    ("Mesa de Escritório", "Móveis", 650.00),
    ("Fone de Ouvido", "Eletrônico", 199.90),
    ("Micro-ondas", "Eletrodoméstico", 799.00),
    ("Mochila", "Acessórios", 220.00),
    ("Jaqueta", "Vestuário", 350.00),
    ("Monitor", "Eletrônico", 1200.00),
    ("Bicicleta", "Esporte", 1800.00),
    ("Smartnigga", "Eletrônico", 0,50)]

s = []
for a in range(len(produtos)):
        i = produtos[a][1]
        s.append(i)
         
print(f"Categorias disponíveis:{"\n".join(s)}")
input()

    # categoria = input("Digite qual categoria voce quer: ").lower()
    # categoria = remover_acentos(categoria)

    # filtro = [p for p in produtos if remover_acentos(p[1].lower()) == categoria]
    # if filtro:
    #  for o in filtro:
    #     print(f"Produto: {o[0]} _____ Categoria: {o[1]} (R$) {o[2]}:")
    # else:
    #     print("Não achamos essa catedoria, tente novamente!")
    #     continue
    # sair = input ("quer continuar(N/Y)?\n").strip().upper()
    # if sair == "N":
    #     print("adeus")
    #     break    