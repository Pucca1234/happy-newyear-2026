# Happy New Year 2026

2026 새해 카운트다운과 덕담을 실시간으로 나누는 원페이지 웹앱입니다.

## Supabase 키 (비개발자 안내)
이 앱은 Supabase라는 서비스의 "키" 2개가 필요합니다.

1) Supabase 웹사이트에 로그인 후 프로젝트를 선택합니다.  
2) 화면 왼쪽 아래 **Project Settings** → **API**로 이동합니다.  
3) 다음 두 값을 복사해 보관합니다.  
   - **Project URL**  
   - **Anon (public) key**

## 환경변수 설정
프로젝트 폴더에 있는 `.env.example` 파일을 복사해서 `.env.local`을 만들고,
아래처럼 값을 붙여 넣습니다.

```bash
NEXT_PUBLIC_SUPABASE_URL=Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=Anon (public) key
```

Vercel에 배포할 때도 동일한 2개 값을 **Environment Variables**에 등록하면 됩니다.

## 실행 방법
```bash
npm run dev
```

브라우저에서 `http://localhost:3000`에 접속하면 확인할 수 있습니다.
