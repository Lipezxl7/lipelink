from selenium import webdriver
import pyperclip
import time as tp
import pyautogui

site = webdriver.Chrome()
site.get("https://temp-mail.org/pt/")
site.maximize_window()
tp.sleep(9)
gmail = site.find_element("xpath",  "//button[@data-clipboard-target='#mail']")
gmail.click()
tp.sleep(1)
copiado = pyperclip.paste(gmail)
tp.sleep(1)
print(copiado)
tp.sleep(4)