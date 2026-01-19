package handler

import (
	"encoding/json"
	"net/http"
)

// Response 标准 API 响应结构
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

// WriteJSON 写入 JSON 响应
func WriteJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

// WriteSuccess 写入成功响应
func WriteSuccess(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

// WriteError 写入错误响应
func WriteError(w http.ResponseWriter, statusCode int, message string) {
	WriteJSON(w, statusCode, Response{
		Success: false,
		Error:   message,
	})
}

// WriteCreated 写入创建成功响应
func WriteCreated(w http.ResponseWriter, data interface{}) {
	WriteJSON(w, http.StatusCreated, Response{
		Success: true,
		Data:    data,
		Message: "创建成功",
	})
}

// WriteNoContent 写入无内容响应
func WriteNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}
