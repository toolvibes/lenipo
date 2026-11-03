from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar, BinaryIO, TextIO, TYPE_CHECKING, Generator

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

from typing import cast
from uuid import UUID

if TYPE_CHECKING:
  from ..models.admin_token_owner import AdminTokenOwner
  from ..models.token_limits import TokenLimits





T = TypeVar("T", bound="AdminToken")



@_attrs_define
class AdminToken:
    """ 
        Attributes:
            id (UUID):
            name (str):
            prefix (str):
            owner (AdminTokenOwner):
            scopes (list[str]):
            expires_at (str):
            last_used_at (None | str):
            limits (TokenLimits):
            used_today (int):
     """

    id: UUID
    name: str
    prefix: str
    owner: AdminTokenOwner
    scopes: list[str]
    expires_at: str
    last_used_at: None | str
    limits: TokenLimits
    used_today: int





    def to_dict(self) -> dict[str, Any]:
        from ..models.admin_token_owner import AdminTokenOwner # noqa: PLC0415
        from ..models.token_limits import TokenLimits # noqa: PLC0415
        id = str(self.id)

        name = self.name

        prefix = self.prefix

        owner = self.owner.to_dict()

        scopes = self.scopes



        expires_at = self.expires_at

        last_used_at: None | str
        last_used_at = self.last_used_at

        limits = self.limits.to_dict()

        used_today = self.used_today


        field_dict: dict[str, Any] = {}

        field_dict.update({
            "id": id,
            "name": name,
            "prefix": prefix,
            "owner": owner,
            "scopes": scopes,
            "expiresAt": expires_at,
            "lastUsedAt": last_used_at,
            "limits": limits,
            "usedToday": used_today,
        })

        return field_dict



    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.admin_token_owner import AdminTokenOwner # noqa: PLC0415
        from ..models.token_limits import TokenLimits # noqa: PLC0415
        d = dict(src_dict)
        id = UUID(d.pop("id"))




        name = d.pop("name")

        prefix = d.pop("prefix")

        owner = AdminTokenOwner.from_dict(d.pop("owner"))




        scopes = cast(list[str], d.pop("scopes"))


        expires_at = d.pop("expiresAt")

        def _parse_last_used_at(data: object) -> None | str:
            if data is None:
                return data
            return cast(None | str, data)

        last_used_at = _parse_last_used_at(d.pop("lastUsedAt"))


        limits = TokenLimits.from_dict(d.pop("limits"))




        used_today = d.pop("usedToday")

        admin_token = cls(
            id=id,
            name=name,
            prefix=prefix,
            owner=owner,
            scopes=scopes,
            expires_at=expires_at,
            last_used_at=last_used_at,
            limits=limits,
            used_today=used_today,
        )

        return admin_token

