# CODIGO PARA FAZER ELE RODAR INFINITAMENTE
# PYAUTOGUI e uma biblioteca que mexe com o mouse e teclado.
import pyautogui as auto
# Serve para ver as coordenadas da ultima posicao do mouse.
print(auto.position())
# Ela move o cursor para uma posicao (funciona com x,y). 
# Duration seria a demora que vai para a coordenada desejada.
auto.moveTo( 1801, 61, duration=1)
# Faz clickar na coordenada desejada.
auto.click(1801, 61)
# Pronto codigo infinito sem loop.

# OUTRAS FUNCOES.
# Aperta com o lado esquerdo do mouse.
auto.leftClick()
# Aperta com o lado direto do mouse.
auto.rightClick()
# Da um doubleClick no mouse.
auto.doubleClick()
