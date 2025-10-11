import pyfiglet as pyf

ez = pyf.figlet_format("bem vindo a calculadora virtual!!")
print(ez)
print("1 - Soma\n2 - Subtração\n3 - Divisão\n4 - Multiplicação")

contas = {
    1: ("soma", lambda x, y: x + y),
    2: ("subtração", lambda x, y: x - y),
    3: ("divisão", lambda x, y: x / y),
    4: ("multiplicação", lambda x, y: x * y)
}

while True:
    opcao = int(input("Escolha sua opção (1-4): "))

    if opcao in contas:
        num1 = float(input("Digite o primeiro número: "))
        num2 = float(input("Digite o segundo número: "))

        nome, func = contas[opcao]
        print(f"A {nome} deu {func(num1, num2)}")
    else:
        print("Opção inválida!")

    continuar = input("Você quer continuar? (Y/N): ").strip().upper()
    if continuar == "N":
        print("Saindo da calculadora... Até mais!")
        break
