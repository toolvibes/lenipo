from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from ..types import UNSET, Unset
from typing import cast
from typing import Literal, cast






T = TypeVar("T", bound="UpdateAiSettingsRequest")



@_attrs_define
class UpdateAiSettingsRequest:
    """ 
        Attributes:
            base_url (Literal[''] | str):
            chat_model (str):
            embedding_model (str):
            daily_limit (int):
            api_key (str | Unset):
            query_prefix (str | Unset):  Default: ''.
            document_prefix (str | Unset):  Default: ''.
     """

    base_url: Literal[''] | str
    chat_model: str
    embedding_model: str
    daily_limit: int
    api_key: str | Unset = UNSET
    query_prefix: str | Unset = ''
    document_prefix: str | Unset = ''
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)





    def to_dict(self) -> dict[str, Any]:
        base_url: Literal[''] | str
        base_url = self.base_url

        chat_model = self.chat_model

        embedding_model = self.embedding_model

        daily_limit = self.daily_limit

        api_key = self.api_key

        query_prefix = self.query_prefix

        document_prefix = self.document_prefix


        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({
            "baseUrl": base_url,
            "chatModel": chat_model,
            "embeddingModel": embedding_model,
            "dailyLimit": daily_limit,
        })
        if api_key is not UNSET:
            field_dict["apiKey"] = api_key
        if query_prefix is not UNSET:
            field_dict["queryPrefix"] = query_prefix
        if document_prefix is not UNSET:
            field_dict["documentPrefix"] = document_prefix

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        def _parse_base_url(data: object) -> Literal[''] | str:
            base_url_type_0 = cast(Literal[''] , data)
            if base_url_type_0 != '':
                raise ValueError(f"baseUrl_type_0 must match const '', got '{base_url_type_0}'")
            return base_url_type_0
            return cast(Literal[''] | str, data)

        base_url = _parse_base_url(d.pop("baseUrl"))


        chat_model = d.pop("chatModel")

        embedding_model = d.pop("embeddingModel")

        daily_limit = d.pop("dailyLimit")

        api_key = d.pop("apiKey", UNSET)

        query_prefix = d.pop("queryPrefix", UNSET)

        document_prefix = d.pop("documentPrefix", UNSET)

        update_ai_settings_request = cls(
            base_url=base_url,
            chat_model=chat_model,
            embedding_model=embedding_model,
            daily_limit=daily_limit,
            api_key=api_key,
            query_prefix=query_prefix,
            document_prefix=document_prefix,
        )


        update_ai_settings_request.additional_properties = d
        return update_ai_settings_request

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties
