package comm

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	// ErrInvalidToken JWT Token 无效
	ErrInvalidToken = errors.New("invalid token")
	// ErrExpiredToken JWT Token 已过期
	ErrExpiredToken = errors.New("token expired")
)

// Claims JWT 声明
type Claims struct {
	SlaveID   int64  `json:"slave_id"`
	SlaveName string `json:"slave_name"`
	jwt.RegisteredClaims
}

// JWTAuth JWT 认证管理器
type JWTAuth struct {
	secretKey []byte
	issuer    string
	duration  time.Duration
}

// NewJWTAuth 创建 JWT 认证管理器
func NewJWTAuth(secretKey, issuer string, duration time.Duration) *JWTAuth {
	return &JWTAuth{
		secretKey: []byte(secretKey),
		issuer:    issuer,
		duration:  duration,
	}
}

// GenerateToken 生成 JWT Token
func (j *JWTAuth) GenerateToken(slaveID int64, slaveName string) (string, error) {
	now := time.Now()
	claims := &Claims{
		SlaveID:   slaveID,
		SlaveName: slaveName,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    j.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(j.duration)),
			NotBefore: jwt.NewNumericDate(now),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(j.secretKey)
}

// ValidateToken 验证 JWT Token
func (j *JWTAuth) ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		// 验证签名方法
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return j.secretKey, nil
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, ErrInvalidToken
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}

	return nil, ErrInvalidToken
}

// RefreshToken 刷新 Token（生成新的 Token）
func (j *JWTAuth) RefreshToken(oldToken string) (string, error) {
	claims, err := j.ValidateToken(oldToken)
	if err != nil && !errors.Is(err, ErrExpiredToken) {
		return "", err
	}

	// 生成新的 Token
	return j.GenerateToken(claims.SlaveID, claims.SlaveName)
}
