// Added 2026-11-03 (QA: "you will need more data"). Every country in generate.ts and countries.ts was in use and
// the ledger (test-data/_generated-emails.txt) held about 20000 emails, so the generator ran out of fresh names.
// Each entry below adds 10 first names and 10 last names to a country that already exists, which adds 300 new
// first.last combinations for that country. Purely additive: nothing existing is changed or removed.
export const MORE_NAMES: Record<string, { first: string[]; last: string[] }> = {
  'United Kingdom': { first: ['Oliver', 'Amelia', 'Harry', 'Isla', 'Jack', 'Poppy', 'Alfie', 'Freya', 'Archie', 'Ruby'], last: ['Whitaker', 'Pemberton', 'Hargreaves', 'Ashworth', 'Thornton', 'Fairbanks', 'Holloway', 'Lockwood', 'Marsden', 'Sutcliffe'] },
  Germany: { first: ['Lukas', 'Hannah', 'Felix', 'Lena', 'Jonas', 'Mia', 'Maximilian', 'Clara', 'Leon', 'Johanna'], last: ['Brandt', 'Kessler', 'Albrecht', 'Vogel', 'Lehmann', 'Engel', 'Hartmann', 'Sommer', 'Reinhardt', 'Kruger'] },
  Canada: { first: ['Liam', 'Chloe', 'Noah', 'Emma', 'Ethan', 'Olivia', 'Mason', 'Ava', 'Logan', 'Sophie'], last: ['MacLeod', 'Tremblay', 'Gagnon', 'Campbell', 'Fraser', 'Bouchard', 'Lavoie', 'Sinclair', 'Morrison', 'Ouellet'] },
  Australia: { first: ['Hudson', 'Matilda', 'Lachlan', 'Harper', 'Riley', 'Evie', 'Cooper', 'Charlotte', 'Flynn', 'Willow'], last: ['Pearce', 'Hartley', 'Donovan', 'Gallagher', 'Whelan', 'Prescott', 'Kingsley', 'Redmond', 'Sheehan', 'Tulloch'] },
  Mexico: { first: ['Emiliano', 'Ximena', 'Mateo', 'Regina', 'Diego', 'Renata', 'Leonardo', 'Fernanda', 'Santiago', 'Paulina'], last: ['Villarreal', 'Cardenas', 'Escobar', 'Montoya', 'Orozco', 'Salazar', 'Zamora', 'Carrillo', 'Barrera', 'Mendoza'] },
  Poland: { first: ['Jakub', 'Zofia', 'Mateusz', 'Maja', 'Szymon', 'Julia', 'Kacper', 'Hanna', 'Michal', 'Aleksandra'], last: ['Kowalczyk', 'Wojcik', 'Kaminski', 'Lewandowski', 'Zielinski', 'Szymanski', 'Wozniak', 'Dabrowski', 'Kozlowski', 'Jankowski'] },
  Netherlands: { first: ['Sem', 'Tess', 'Luuk', 'Anna', 'Milan', 'Eva', 'Finn', 'Isa', 'Gijs', 'Merel'], last: ['Jansen', 'De Vries', 'Van Dijk', 'Bos', 'Vos', 'Peters', 'Hoekstra', 'Maas', 'Prins', 'Koster'] },
  Turkey: { first: ['Yusuf', 'Asli', 'Emirhan', 'Gizem', 'Berk', 'Merve', 'Ozan', 'Busra', 'Alp', 'Irem'], last: ['Celik', 'Sahin', 'Arslan', 'Dogan', 'Kilic', 'Erdogan', 'Polat', 'Aksoy', 'Cakir', 'Tas'] },
  Portugal: { first: ['Goncalo', 'Ines', 'Rodrigo', 'Carolina', 'Diogo', 'Madalena', 'Henrique', 'Sofia', 'Afonso', 'Joana'], last: ['Ferreira', 'Carvalho', 'Pinheiro', 'Magalhaes', 'Tavares', 'Moreira', 'Amaral', 'Coelho', 'Lopes', 'Marques'] },
  Finland: { first: ['Elias', 'Emilia', 'Oskari', 'Sofia', 'Eetu', 'Aada', 'Niko', 'Lilja', 'Juho', 'Pihla'], last: ['Mattila', 'Hakala', 'Lahtinen', 'Makela', 'Hiltunen', 'Saarinen', 'Karjalainen', 'Aaltonen', 'Ojala', 'Kinnunen'] },
  Argentina: { first: ['Thiago', 'Lucia', 'Lautaro', 'Julieta', 'Tomas', 'Martina', 'Ramiro', 'Catalina', 'Matias', 'Abril'], last: ['Ferrari', 'Villalba', 'Ibarra', 'Quiroga', 'Maldonado', 'Paz', 'Correa', 'Funes', 'Guerrero', 'Bustos'] },
  Vietnam: { first: ['Anh', 'Mai', 'Bao', 'Lan', 'Duc', 'Hanh', 'Tuan', 'Yen', 'Long', 'Thu'], last: ['Le', 'Huynh', 'Phan', 'Dinh', 'Duong', 'Ly', 'Mai', 'Ha', 'Lam', 'Trinh'] },
  Kenya: { first: ['Baraka', 'Zawadi', 'Juma', 'Neema', 'Kiprono', 'Wambui', 'Maina', 'Akinyi', 'Kibet', 'Mumbi'], last: ['Ndungu', 'Karanja', 'Githinji', 'Ochieng', 'Langat', 'Mutua', 'Kiplagat', 'Wafula', 'Njoroge', 'Barasa'] },
  Thailand: { first: ['Anan', 'Siriporn', 'Preecha', 'Kanya', 'Nattapong', 'Ploy', 'Surachai', 'Jiraporn', 'Wichai', 'Pranee'], last: ['Charoen', 'Phanich', 'Suwan', 'Intharat', 'Saetang', 'Wattana', 'Limsakul', 'Pongpan', 'Thammarat', 'Khamphon'] },
  Nigeria: { first: ['Chinedu', 'Ngozi', 'Emeka', 'Folake', 'Tunde', 'Adaeze', 'Ikenna', 'Yetunde', 'Segun', 'Amara'], last: ['Okafor', 'Adeyemi', 'Nwosu', 'Balogun', 'Eze', 'Ogunbanjo', 'Chukwu', 'Olawale', 'Obi', 'Abubakar'] },
  Egypt: { first: ['Karim', 'Nour', 'Mostafa', 'Salma', 'Hassan', 'Yasmin', 'Tarek', 'Dina', 'Amr', 'Heba'], last: ['Farouk', 'Saad', 'Habib', 'Nasser', 'Zaki', 'Mansour', 'Sabry', 'Ghanem', 'Fawzy', 'Hegazy'] },
  Indonesia: { first: ['Budi', 'Putri', 'Agus', 'Dewi', 'Rizky', 'Sari', 'Dimas', 'Ayu', 'Fajar', 'Wulan'], last: ['Santoso', 'Wijaya', 'Hidayat', 'Saputra', 'Kusuma', 'Pratama', 'Nugroho', 'Lestari', 'Setiawan', 'Rahmat'] },
  Philippines: { first: ['Jose', 'Maria', 'Miguel', 'Angelica', 'Paolo', 'Bianca', 'Carlo', 'Katrina', 'Marco', 'Jasmine'], last: ['Reyes', 'Santos', 'Bautista', 'Villanueva', 'Aquino', 'Castillo', 'Mercado', 'Soriano', 'Dizon', 'Magno'] },
  Ireland: { first: ['Conor', 'Aoife', 'Cian', 'Niamh', 'Darragh', 'Saoirse', 'Eoin', 'Orla', 'Fionn', 'Roisin'], last: ['Gallagher', 'Doherty', 'Brennan', 'Fitzgerald', 'Kavanagh', 'Maguire', 'Quigley', 'Dunne', 'Hennessy', 'Moran'] },
  Norway: { first: ['Sander', 'Ingrid', 'Magnus', 'Frida', 'Henrik', 'Thea', 'Kristian', 'Marte', 'Andreas', 'Sigrid'], last: ['Halvorsen', 'Berg', 'Solberg', 'Haugen', 'Dahl', 'Lund', 'Strand', 'Moen', 'Eide', 'Nygaard'] },
};
