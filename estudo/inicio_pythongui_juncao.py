# ESCREVENDO COISA NO BLOCO DE NOTAS E SAINDO COM O MOUSE(JUNCAO)
import inicio_pyautogui_teclado as tel
import pyautogui as auto
import time as tp
# Importei o arquivo que fazia o bloco de notas
tel.teclado()
tp.sleep(1)
# Eu to levando o mouse ate o botao de sair e apertando 
auto.moveTo(1897,15, duration=2)
auto.click(1897,15)