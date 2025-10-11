# ABRINDO O BLOCO DE NOTAS E MANDANDO UMA MENSAGEM.
# PYAUTOGUI e uma biblioteca que mexe o mouse e o teclado.
import pyautogui as auto
import time
# subprocess e uma biblioteca do proprio python que se comunica com o sistema.
import subprocess

def teclado():
 import subprocess
 import pyautogui as auto
 import time
# subprocess.Popen ele esta abrindo o bloco de notas.
subprocess.Popen(["notepad"])
time.sleep(1)
# Hotkey e uma funcao para que faca comandos especiais do windows.
auto.hotkey('alt', 'space')
time.sleep(0.2)
# Press serve para apertar alguma tecla.
auto.press('x')
time.sleep(1)
# Write serve para escrever algo.
# Interval e a velocidade que ele escreve.
auto.write("sexta feira, play tv nois ta como no recolhe", interval=0.1)
# Acrecentei para ele apagar o que eu tinha escrevido.
# Ctrl + a pra selecionar tudo o meu texto.
auto.hotkey('ctrl','a')
# Apagando. 
auto.press('Backspace')