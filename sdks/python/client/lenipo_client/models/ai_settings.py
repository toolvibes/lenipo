from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.ai_settings_indexed import AiSettingsIndexed





T = TypeVar("T", bound="AiSettings")



@_attrs_define
class AiSettings:
    """ 
        Attributes:
            base_url (str):
            has_api_key (bool):
            chat_model (str):
            embedding_model (str):
            query_prefix (str):
            document_prefix (str):
            daily_limit (int):
            used_today (int):
            vector_available (bool):
            indexed (AiSettingsIndexed):
     """

    base_url: str
    has_api_key: bool
    chat_model: str
    embedding_model: str
    query_prefix: str
    document_prefix: str
    daily_limit: int
    used_today: int
    vector_available: bool
    indexed: AiSettingsIndexed





    def to_dict(self) -> dict[str, Any]:
        from ..models.ai_settings_indexed import AiSettingsIndexed # noqa: PLC0415
        base_url = self.base_url

        has_api_key = self.has_api_key

        chat_model = self.chat_model

        embedding_model = self.embedding_model

        query_prefix = self.query_prefix

        document_prefix = self.document_prefix

        daily_limit = self.daily_limit

        used_today = self.used_today

        vector_available = self.vector_available

        indexed = self.indexed.to_dict()


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "baseUrl": base_url,
            "hasApiKey": has_api_key,
            "chatModel": chat_model,
            "embeddingModel": embedding_model,
            "queryPrefix": query_prefix,
            "documentPrefix": document_prefix,
            "dailyLimit": daily_limit,
            "usedToday": used_today,
            "vectorAvailable": vector_available,
            "indexed": indexed,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.ai_settings_indexed import AiSettingsIndexed # noqa: PLC0415
        d = dict(src_dict)
        base_url = d.pop("baseUrl")

        has_api_key = d.pop("hasApiKey")

        chat_model = d.pop("chatModel")

        embedding_model = d.pop("embeddingModel")

        query_prefix = d.pop("queryPrefix")

        document_prefix = d.pop("documentPrefix")

        daily_limit = d.pop("dailyLimit")

        used_today = d.pop("usedToday")

        vector_available = d.pop("vectorAvailable")

        indexed = AiSettingsIndexed.from_dict(d.pop("indexed"))




        ai_settings = cls(
            base_url=base_url,
            has_api_key=has_api_key,
            chat_model=chat_model,
            embedding_model=embedding_model,
            query_prefix=query_prefix,
            document_prefix=document_prefix,
            daily_limit=daily_limit,
            used_today=used_today,
            vector_available=vector_available,
            indexed=indexed,
        )

        return ai_settings

