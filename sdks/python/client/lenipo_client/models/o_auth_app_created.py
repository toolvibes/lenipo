from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast

if TYPE_CHECKING:
  from ..models.o_auth_app import OAuthApp





T = TypeVar("T", bound="OAuthAppCreated")



@_attrs_define
class OAuthAppCreated:
    """ 
        Attributes:
            app (OAuthApp):
            client_secret (None | str):
     """

    app: OAuthApp
    client_secret: None | str





    def to_dict(self) -> dict[str, Any]:
        from ..models.o_auth_app import OAuthApp # noqa: PLC0415
        app = self.app.to_dict()

        client_secret: None | str
        client_secret = self.client_secret


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "app": app,
            "clientSecret": client_secret,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.o_auth_app import OAuthApp # noqa: PLC0415
        d = dict(src_dict)
        app = OAuthApp.from_dict(d.pop("app"))




        def _parse_client_secret(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        client_secret = _parse_client_secret(d.pop("clientSecret"))


        o_auth_app_created = cls(
            app=app,
            client_secret=client_secret,
        )

        return o_auth_app_created

