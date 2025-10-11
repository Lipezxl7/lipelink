import pandas as pd
import os 
import openpyxl as op
import pyfiglet as pf
from colorama import Fore , init 
cam = (r"C:\lipe.bot\lipe.bot\sisbb")
caminho = os.path.join(cam + ".xlsx")
if os.path.exists(caminho):
 ba = (pf.figlet_format("SISBB"))
 while True:
    print(Fore.GREEN + ba)
    x = int(input("\n1.adicionar na planilha       2.abrir excel\n3.funcionarios                4.sair\n\n        "))
    if x == 1:
     os.system('cls')
     antigo = pd.read_excel(caminho)
     df = pd.DataFrame([{
            "matricula": input("qual e a sua matrcula: ").capitalize(),
            "nome": input("qual e o seu nome: ").capitalize(),
            "idade": int(input("sua idade: ")),
            "admissao": input("quando voce foi admitido(xx/xx/xxxx): "),
            "agencia": int(input("qual agencia voce e (apenas numeros): ")),
            "cargo": input("cargo: ").capitalize()}])
     df = pd.concat([antigo,df], ignore_index=True) 
     df.to_excel(caminho, index= False)
     os.system('cls')
     print("adicionado com sucesso")
     continue
    #abrir o arquivo   
    elif x == 2:  
       os.startfile(caminho)
       break
    #sair
    elif x == 4:
     break
     #Informacaoes
    elif x == 3:
       os.system('cls')
       x = pd.read_excel(r"C:\lipe.bot\lipe.bot\sisbb.xlsx")
       matricula = x["matricula"]
       print(Fore.GREEN + ba)
       m = matricula.to_list()
       acesso = input("fale a sua matricula: ").capitalize()
       if acesso in m:
        filtro=  x[x["matricula"] == acesso]
        nome = filtro['nome'].values[0]
       admissao = filtro['admissao'].values[0]
       idade = filtro['idade'].values[0]
       age = filtro['agencia'].values[0]
       cargo = filtro['cargo'].values[0]

       os.system('cls')
       info = pf.figlet_format("informacoes")
       print(Fore.GREEN + info)
       print(f"Nome: {nome}\nIdade: {idade}\nAgencia: {age}\nData de Admissao: {admissao}\nCargo: {cargo}")
       
       y = int(input("\n\n1.voltar             2.sair\n\n"))
       if y == 1:
         os.system('cls')
         continue
       elif y == 2:
         break
       else:
         print("opcao invalida")
         continue
  
    else:
       print("opcao invalida")
       break       
    
else:
    ba = (pf.figlet_format("                                 SISBB"))
    print(Fore.GREEN + ba)
    x = int(input("                       \n                             1.criar uma planilha       \n\n       \n\n        "))
    if x == 1:
     os.system('cls')
     dicionario = pd.DataFrame([{
            "matricula": input("qual e a sua matrcula: ").capitalize(),
            "nome": input("qual e o seu nome: ").capitalize(),
            "idade": int(input("sua idade: ")),
            "admissao": input("quando voce foi admitido(xx/xx/xxxx): "),
            "agencia": int(input("qual agencia voce e (apenas numeros): ")),
            "cargo": input("cargo: ").capitalize()}])
     dicionario.to_excel(caminho, index = False)
     print("planilha criada com sucesso! renicie o programa para acrecentar mais")
     y = int(input("                      1.renicie       2.sair"))
     if y == 1:
       os.startfile(r"C:\lipe.bot\lipe.bot\ecel.py")
       input("")
     else:
       pass 
    elif x == 2:
      pass