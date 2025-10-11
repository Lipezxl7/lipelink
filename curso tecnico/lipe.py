import pyfiglet as pyf
print (pyf.figlet_format("bem vindo a calculadora virtual!"))

print("1: Soma\n 2: Subtração\n 3: Divisão\n 4: Multiplicação ")


operacao = {
        1: ("soma", lambda x, y: x + y),
        2: ("subtração", lambda x,y: x-y),
        3: ("Divisão", lambda x,y: x/y),
        4: ("Multiplicação", lambda x,y: x*y)
    }


while True:
    opcoes = int(input("fale um numero de (1-4) : "))

    if opcoes in operacao:
        num1 = float(input("fale o primeiro numero : "))
        num2 = float(input("fale o segundo numero : "))
       
        nome, funci = operacao[opcoes]
        print(f"o {nome} deu {funci(num1,num2)}")
    else:
        print("Opção invalida")

    ez1 = input("voce quer continuar? (N/Y) : ").upper().strip()
    if ez1 == "N":
           print("adeus")
           break
