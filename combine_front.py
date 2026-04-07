import os

output_filename = "frontend_code.txt"
# Папки, куда скрипту лезть не надо
exclude_dirs = {'.git', 'node_modules', '.github'}
# Собираем только эти форматы (если добавишь картинки, он их проигнорит)
allowed_extensions = {'.html', '.js', '.css'}

with open(output_filename, 'w', encoding='utf-8') as outfile:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        
        for file in files:
            if any(file.endswith(ext) for ext in allowed_extensions):
                filepath = os.path.join(root, file)
                
                outfile.write(f"\n\n{'='*50}\n")
                outfile.write(f"Файл: {filepath}\n")
                outfile.write(f"{'='*50}\n\n")
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"# Ошибка чтения файла: {e}\n")

print(f"Готово! Весь фронтенд собран в {output_filename}")
