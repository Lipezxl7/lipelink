#selenium - (selenium e uma biblioteca que faz contato com o navegador)
#Webdriver - (Webdriver serve pra fazer contato com o navegador sem ele o codigo nao funciona)
from selenium import webdriver
import time as tm
#escolhendo o navegador(pode ser qualquer outro Chrome, FireFox, Opera, ETC)
drive = webdriver.Chrome()
#usei pra entrar no site da steam
drive.get("https://store.steampowered.com/?l=portuguese")
#colocando em tela cheia
drive.maximize_window()
#procurando o elemento de (iniciar a sessao)
inicio = drive.find_element("id", "global_action_menu")
#clicar no botao iniciar sessao
inicio.click()
#implicitly_wait ele vai esperar o elemento aparecer na tela para fazer o comando.
#(100) e o tempo que ele vai esperar, se esse tempo acabar ele vai continuar com o comando.
drive.implicitly_wait(100)
#procurando o botao de colocar o usuario e ja colocando ele com .send_keys
drive.find_element("class name","_2GBWeup5cttgbTw8FM3tfx").send_keys("niggersboy67")
#como que os dois botoes tem a mesma class temos que procurar varios elementos   
botoes = drive.find_elements("class name","_2GBWeup5cttgbTw8FM3tfx") 
#como que a variavel "botoes" vira uma lista porque tem varios elementos dentro dela
#colocamos "botoes[1]" pra pegar o segundo item da lista que seria a da senha
botoes[1].send_keys("Senha12366")
#apertando o botao entrar na conta 
entrar = drive.find_element("class name", "DjSvCZoKKfoNSmarsEcTS")
entrar.click()
tm.sleep(10)