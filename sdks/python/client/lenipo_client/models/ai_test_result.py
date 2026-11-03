from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.ai_test_result_chat import AiTestResultChat
  from ..models.ai_test_result_embeddings import AiTestResultEmbeddings





T = TypeVar("T", bound="AiTestResult")



@_attrs_define
class AiTestResult:
    """ 
        Attributes:
            chat (AiTestResultChat):
            embeddings (AiTestResultEmbeddings):
     """

    chat: AiTestResultChat
    embeddings: AiTestResultEmbeddings





    def to_dict(self) -> dict[str, Any]:
        from ..models.ai_test_result_chat import AiTestResultChat # noqa: PLC0415
        from ..models.ai_test_result_embeddings import AiTestResultEmbeddings # noqa: PLC0415
        chat = self.chat.to_dict()

        embeddings = self.embeddings.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "chat": chat,
            "embeddings": embeddings,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.ai_test_result_chat import AiTestResultChat # noqa: PLC0415
        from ..models.ai_test_result_embeddings import AiTestResultEmbeddings # noqa: PLC0415
        d = dict(src_dict)
        chat = AiTestResultChat.from_dict(d.pop("chat"))




        embeddings = AiTestResultEmbeddings.from_dict(d.pop("embeddings"))




        ai_test_result = cls(
            chat=chat,
            embeddings=embeddings,
        )

        return ai_test_result

