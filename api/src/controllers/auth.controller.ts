/* eslint-disable @typescript-eslint/unbound-method */
import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import debug, { IDebugger } from 'debug';

import { IUserRequest } from '../types/main';
import UserDao from '../CrudDao/UserDao';
import { IUser, IUserCreate } from '../types/user.type';
import JsonWebToken from '../utils/jwt';
import generatePassword from '../utils/password';

const log: IDebugger = debug('api:controller');

class AuthController {
    public static async signUp(req: Request, res: Response): Promise<unknown> {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        try {
            const {
                password: pwd,
                ...user
            }: IUserCreate = req.body as IUserCreate;

            const hashPassord = await generatePassword(pwd);
            const newUser = await UserDao.create({
                ...user,
                password: hashPassord,
            });

            // If a account already exist.
            if (!newUser) {
                return res.status(409).json({
                    success: false,
                    message: 'Account already exist.',
                });
            }

            const { _id, name, email: mail, createdAt } = newUser;

            const token = JsonWebToken.generate({ _id, name, email: mail });

            return res
                .status(201)
                .json({ user: { _id, name, email: mail, createdAt }, token });
        } catch (error) {
            log(error);
            return res.status(500).json({ message: 'Error server' });
        }
    }

    public static async signIn(req: Request, res: Response): Promise<unknown> {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }

        const { email, password }: IUserCreate = req.body as IUserCreate;

        try {
            const userFind = await UserDao.getByEmail(email);

            if (!userFind) {
                return res.status(401).json({
                    success: false,
                    message: 'Account does not exist.',
                });
            }

            const {
                password: Hash,
                _id,
                name,
                email: mail,
                createdAt,
            } = userFind;

            const generatedToken = await bcrypt.compare(password, Hash);

            if (generatedToken) {
                const token = JsonWebToken.generate(userFind);

                return res.status(200).json({
                    user: { _id, name, email: mail, createdAt },
                    token,
                });
            }

            return res
                .status(401)
                .json({ success: false, message: 'Password is wrong' });
        } catch (error) {
            log(error);
            return res.status(500).json({ message: 'Error server' });
        }
    }

    public static async verifyAuth(req: Request, res: Response): Promise<void> {
        const request = <IUserRequest>(<unknown>req);

        const { _id: id }: IUser = request.user;
        try {
            const { _id, name, email, createdAt } = (await UserDao.getById(
                id,
            )) as IUser;

            res.status(200).json({ user: { _id, name, email, createdAt } });
        } catch (error) {
            log(error);
            res.status(500).json({ message: 'Error server' });
        }
    }
}

export default AuthController;
