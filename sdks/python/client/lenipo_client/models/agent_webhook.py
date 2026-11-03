from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset







T = TypeVar("T", bound="AgentWebhook")



@_attrs_define
class AgentWebhook:
    """ 
        Attributes:
            url (str):
            secret (str):
     """

    url: str
    secret: str





    def to_dict(self) -> dict[str, Any]:
        url = self.url

        secret = self.secret


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "url": url,
            "secret": secret,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        url = d.pop("url")

        secret = d.pop("secret")

        agent_webhook = cls(
            url=url,
            secret=secret,
        )

        return agent_webhook

