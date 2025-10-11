import pandas as pd
import openpyxl as op
import pyfiglet as pf

x = pd.read_excel(r"C:\lipe.bot\lipe.bot\sisbb.xlsx")
matricula = x["matricula"]
print(pf.figlet_format("SISBB"))
m = matricula.to_list()
acesso = input("fale a sua matricula: ").capitalize()
if acesso in m:
  filtro=  x[x["matricula"] == acesso]
  nome = filtro['nome'].values[0]
  admissao = filtro['admissao'].values[0]
  idade = filtro['idade'].values[0]
  age = filtro['agencia'].values[0]
  cargo = filtro['cargo'].values[0]

  
  print(pf.figlet_format("informacoes"))
  print(f"Nome: {nome}\nIdade: {idade}\nAgencia: {age}\nData de Admissao: {admissao}\nCargo: {cargo}")
  
else:
  print("opcao invalida")