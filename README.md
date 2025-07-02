# Firebase Studio

This is a NextJS starter in Firebase Studio.

## 배포하기 (Publishing your app)

이 앱은 Firebase App Hosting을 사용하여 배포하도록 구성되어 있습니다. Studio에서 앱을 배포하는 가장 간단하고 빠른 방법은 'Publish' 버튼을 사용하는 것입니다.

### 'Publish' 버튼으로 배포하기

Studio 인터페이스의 **'Publish'** 버튼은 현재 코드를 **실시간 웹사이트**에 빠르고 쉽게 배포하는 기능입니다.

*   **언제 사용하나요?**: 변경 사항을 실제 서비스에 반영하고 싶을 때 사용합니다.
*   **어떻게 작동하나요?**: 'Publish'를 누르면 현재 작업 내용이 빌드되어 새로운 버전으로 배포됩니다. 배포가 완료되면, 부여된 URL을 통해 누구나 접속할 수 있습니다.
*   **장점**: 복잡한 명령어 없이 클릭 한 번으로 배포 과정을 자동화할 수 있습니다.

**요약:**
*   **앱 배포 및 업데이트**: Studio의 **'Publish'** 버튼을 사용하세요.

## 더 짧은 `web.app` 주소 사용하기

기본적으로 이 앱은 `...hosted.app` 주소를 사용하는 **Firebase App Hosting**에 배포됩니다. 만약 `...web.app`으로 끝나는 더 짧고 기억하기 쉬운 주소를 사용하고 싶으시다면, **Firebase Hosting**을 별도로 설정해야 합니다.

*   **App Hosting (`...hosted.app`)**: 현재 사용 중인 서비스로, Studio의 'Publish' 버튼으로 쉽게 배포할 수 있도록 최적화되어 있습니다.
*   **Firebase Hosting (`...web.app`)**: 주로 정적 콘텐츠를 위한 호스팅 서비스이지만, Cloud Functions나 Cloud Run과 연결하여 동적인 앱도 운영할 수 있습니다. `web.app` 주소를 제공하며, Firebase 콘솔에서 직접 설정해야 합니다.

**주의:** `web.app` 주소로 변경하는 것은 단순히 코드 수정만으로 불가능하며, Firebase 프로젝트의 호스팅 설정을 직접 변경해야 하는 작업입니다. 이 작업은 Studio 외부에서 Firebase CLI(명령줄 도구)를 사용하여 진행해야 할 수 있으며, 현재 Studio의 'Publish' 기능과는 다른 배포 방식을 사용하게 됩니다.
