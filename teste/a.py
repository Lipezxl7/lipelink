import pyfiglet
from colorama import Fore, Style, init
init(autoreset=True)

print(Fore.GREEN + Style.BRIGHT + pyfiglet.figlet_format("SISBB"))
print(Fore.BLUE + "1. adicionar na planilha".ljust(30) + "2. abrir excel")
print(Fore.BLUE + "3. funcionários".ljust(30) + "4. sair")
input()
