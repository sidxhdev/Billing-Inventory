pipeline {
    agent any
    options {
        timestamps()
    }
    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }
        stage('Backend Tests') {
            steps {
                sh 'python3 -m venv .venv'
                sh '.venv/bin/pip install --upgrade pip'
                sh '.venv/bin/pip install -r backend/requirements-dev.txt'
                sh '.venv/bin/python -m pytest backend/tests -q'
            }
        }
        stage('Frontend Build') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }
    }
    post {
        always {
            sh 'rm -rf .venv frontend/build || true'
        }
        success {
            echo 'CI checks passed. Render and Vercel deploy from Git.'
        }
        failure {
            echo 'CI checks failed.'
        }
    }
}
